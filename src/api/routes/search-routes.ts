import { Router } from 'express';
import { SearchCriteria } from '../../search/search-criteria';
import { SearchService } from '../../search/search-service';
import { DateRange } from '../../shared/date-range';
import { searchResultJson } from '../serializers';
import {
  JsonObject,
  queryList,
  queryNumber,
  queryString,
  requireQueryInteger,
  requireQueryString,
} from '../validation';

export function searchRoutes(search: SearchService): Router {
  const router = Router();

  router.get('/properties/search', async (req, res) => {
    const query = req.query as JsonObject;
    const criteria: SearchCriteria = {
      city: requireQueryString(query, 'city'),
      locality: queryString(query, 'locality'),
      dateRange: DateRange.of(requireQueryString(query, 'fromDate'), requireQueryString(query, 'toDate')),
      guestCount: requireQueryInteger(query, 'guests'),
      minPrice: queryNumber(query, 'minPrice'),
      maxPrice: queryNumber(query, 'maxPrice'),
      amenities: queryList(query, 'amenities'),
      minStarRating: queryNumber(query, 'minStars'),
      roomType: queryString(query, 'roomType'),
    };

    const results = await search.search(criteria);

    res.json({ results: results.map(searchResultJson) });
  });

  return router;
}
