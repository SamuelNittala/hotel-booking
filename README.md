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
