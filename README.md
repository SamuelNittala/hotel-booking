# Hotel Booking

A small hotel booking backend. Owners add properties and rooms, guests search for a place to stay, book a room, pay for it, and cancel if plans change. Everything lives in memory, so restarting the server wipes all data.

It's written in TypeScript on Express.

## Running it

You need a recent version of Node. I built and tested it on Node 26.

```bash
npm install
npm start
```

The server comes up on http://localhost:3000. To use another port:

```bash
PORT=4000 npm start
```

`npm run dev` does the same but restarts when you change a file.

Other commands:

```bash
npm test          # run the test suite
npm run typecheck # type-check without building
```

## What it does

- **Add a property.** One property or many per owner, with rooms added up front or later.
- **Search.** Find properties by city and dates, then narrow by locality, price range, amenities, star rating, room type and guest count. Only rooms that are actually free for those dates come back, with the total price for the stay.
- **Book.** Pick a property, a room type and dates, and the server assigns a free room of that type. Two people can't get the same room for overlapping nights. The checkout day is free for the next guest.
- **Pay.** Pay with UPI, wallet or card. Payments go through a mock gateway. A successful payment confirms the booking, and a declined one leaves it pending so the guest can try again. After three failed attempts the booking expires.
- **Cancel.** Cancelling releases the room and refunds according to the refund policy. By default that's the full amount if you cancel 7 or more days before check-in, half from 2 days out, and nothing after that.
- **Expire.** A booking that stays unpaid for 15 minutes is expired automatically. The server checks once a minute.

## The API

With the server running, open http://localhost:3000/docs for an interactive page where you can try every endpoint from the browser. The example requests are already filled in. The page loads Swagger UI from a CDN, so it needs internet. The raw spec is in `openapi.yaml` and also served at `/openapi.yaml`.

| Method | Path | What it does |
| --- | --- | --- |
| POST | `/properties` | Add a property (rooms optional) |
| POST | `/properties/:propertyId/rooms` | Add a room to a property |
| GET | `/properties/search` | Search, e.g. `?city=Goa&fromDate=2026-12-20&toDate=2026-12-23&guests=2` |
| POST | `/bookings` | Create a booking (starts as pending) |
| GET | `/bookings/:bookingId` | Look up a booking |
| POST | `/bookings/:bookingId/payments` | Pay for a booking |
| POST | `/bookings/:bookingId/cancel` | Cancel and refund per the policy |
| POST | `/payments/:paymentId/refunds` | Retry or issue a refund by hand |

Search also accepts `locality`, `minPrice`, `maxPrice`, `amenities` (comma separated), `minStars` and `roomType`.

Errors come back as JSON with a sensible status: 400 for bad input, 404 for something that doesn't exist, 409 when the action doesn't fit the current state (for example paying for a cancelled booking), 422 when a business rule says no, and 402 when the payment is declined.

## Trying it out

Add a property with one room:

```bash
curl -X POST localhost:3000/properties -H 'content-type: application/json' -d '{
  "ownerId": 1, "name": "Sea View", "city": "Goa", "locality": "Calangute",
  "latitude": 15.54, "longitude": 73.76, "amenities": ["wifi", "pool"], "starRating": 4,
  "rooms": [{ "type": "deluxe", "capacity": 2, "pricePerNight": 4000 }]
}'
```

The response has the property's id. Use it to book (swap in your own id for `propertyId`):

```bash
curl -X POST localhost:3000/bookings -H 'content-type: application/json' -d '{
  "guestId": 10, "propertyId": 2, "roomType": "deluxe", "guestCount": 2,
  "fromDate": "2026-12-20", "toDate": "2026-12-23"
}'
```

Then pay, using the booking id from that response (it's 1 on a fresh server):

```bash
curl -X POST localhost:3000/bookings/1/payments -H 'content-type: application/json' -d '{
  "method": "UPI", "details": { "upiId": "samuel@okbank" }
}'
```

Wallet takes `{ "walletId": "..." }` and card takes `{ "cardNumber": "..." }` in `details`.

The mock gateway approves everything except payers whose id starts with `decline`. So a UPI id like `decline@okbank` is a quick way to see a failed payment.

IDs are plain numbers handed out in order. Properties and rooms share one counter, which is why the property above gets id 2 on a fresh server: its room took 1. Bookings and payments each count from 1 on their own.

## Key design decisions

**Four layers, each with one job.** Entities (`Booking`, `Payment`, `Room`...) own the rules about their own state. Repositories only store and fetch, and sit behind interfaces with an in-memory version today, so a database can replace them without touching the rest. Services coordinate several things, like taking a payment and then confirming the booking. The REST layer stays thin: check the input, call one service, turn the result into JSON.

**Anything that varies is pluggable.** Search filters, payment methods and refund policies are each an interface. Adding a new one means writing one class and registering it, and nothing else changes. Search filters come in two kinds, ones about the property (city, stars, amenities) and ones about its rooms (price, capacity). All the room filters have to be met by the *same* room, so "fits 3 guests and costs under 5000" can't be satisfied by two different rooms.

**Status changes go through a small table.** A booking can go pending to confirmed, cancelled or expired, and confirmed to cancelled. Anything else throws. Payments work the same way. It keeps the rules in one place and makes a new status a one-line change.

**No double booking.** Reserving a room checks that it's free and records the reservation in one step, with nothing asynchronous in between. Node runs one piece of code at a time, so two guests going for the last room can't both win. Booking never does a separate "is it free?" check first, because that gap is where races come from. Dates are half-open, so the check-out day is free for the next guest.

**Steps are ordered so a failure is safe.** When two steps can't happen together, I picked the order where a crash leaves things annoying instead of wrong:
- Booking reserves the room first, then saves, and gives the room back if the save fails.
- Cancelling saves the new status first, then releases the dates. If the release fails the room stays blocked, which is better than it being bookable while the booking still looks active.
- Cancelling cancels the booking first, then refunds. If the refund fails the booking is still cancelled, the response says the refund failed, and it can be retried.

**Payments are careful about the "paid but too late" case.** The payment is saved as successful before the booking is touched. If the booking was cancelled or expired while the gateway was working, the payment is refunded straight away. Two pay requests for the same booking can't run together (the second gets a 409), and after three declines the booking expires.

**Errors are exceptions, not return values.** The domain throws specific errors, and one table in `error-handler.ts` maps them to HTTP statuses. That keeps the normal path easy to read.

**Unpaid bookings expire through a sweep.** A job runs every minute and expires pending bookings older than 15 minutes. It's simpler than a timer per booking, and it doesn't lose anything on a restart.

**The API spec is written by hand** in `openapi.yaml` and shown with Swagger UI, so it can be tried straight from the browser.

## Assumptions

The brief leaves some things open. This is what I assumed:

- One booking is for one room. Booking several rooms at once isn't supported.
- A guest asks for a room *type*, and the server picks the first free room of that type.
- Price is nights times the nightly price. No taxes, fees or discounts.
- The full amount is paid in one go, through one payment.
- Dates are plain calendar dates (UTC). Check-in is a night you stay, check-out is not.
- An unpaid booking holds its room for 15 minutes.
- There is one refund policy for the whole system (full refund 7+ days before check-in, half from 2 days out, nothing after). It isn't set per property.
- Guest and owner ids are trusted numbers. There's no login or user accounts.
- The payment gateway is a mock. It approves everything unless the payer id starts with `decline`.
- Data lives in memory only.

## What I'd do with more time

- **A real database.** Transactions and a unique constraint on room and date would replace the "check and write together" trick, and a version column would stop two people overwriting each other's edits to a property.
- **Idempotency keys** on booking and payment, so a retried request can't book or charge twice. Right now there's only a guard inside one running server.
- **One price calculator** shared by search and booking. The price is worked out in both places today, which would bite as soon as pricing gets smarter (weekends, seasons, demand).
- **Tighter edges.** Reject dates in the past, stop accepting payment once the 15 minutes are up even if the sweep hasn't run yet, and handle the rare moment where a cancel and a payment land on the same pending booking.
- **Gateway timeouts.** If the gateway doesn't answer, we don't know whether the money moved. That needs a status check or a callback to sort out later.
- **Refund policy per property**, and booking more than one room at once.
- **The usual extras.** Sorting and paging in search, login, a `GET /properties/:id`, and a test that checks `openapi.yaml` against the real routes.
- **A proper production build.** `npm start` runs the TypeScript directly through `tsx`. I didn't set up a compiled build.
