// HTTP routes. Each one calls a function from auth.js / queries.js / actions.js and returns JSON.
import { Router } from 'express';
import { register, login, getCurrentUser, requireLogin } from './auth.js';
import * as read from './queries.js';
import * as write from './actions.js';
import { toClientError, requireInt } from './errors.js';

export const api = Router();

// Wraps a handler so any error becomes a safe JSON message instead of leaking database details.
const route = (handler, successStatus = 200) => async (req, res) => {
  try {
    res.status(successStatus).json(await handler(req));
  } catch (error) {
    const { status, message } = toClientError(error);
    res.status(status).json({ error: message });
  }
};
const idParam = (req) => requireInt(req.params.id, 'Id');

// Public routes
api.post('/auth/register', route((req) => register(req.body), 201));
api.post('/auth/login', route((req) => login(req.body)));

// Everything below needs a valid login token.
api.use(requireLogin);

api.get('/auth/me', route((req) => getCurrentUser(req.businessId)));
api.get('/dashboard', route((req) => read.getDashboard(req.businessId)));

api.get('/businesses', route((req) => read.listBusinesses({ search: String(req.query.search || '').trim(), topRated: req.query.filter === 'top-rated' })));
api.get('/businesses/:id', route((req) => read.getBusinessProfile(idParam(req))));

api.get('/services', route((req) => read.listServices(req.query.filter)));

api.get('/requests', route((req) => read.listRequests(req.businessId, req.query.scope)));
api.get('/requests/:id', route((req) => read.getRequest(req.businessId, idParam(req))));
api.post('/requests', route((req) => write.createRequest(req.businessId, req.body), 201));
api.patch('/requests/:id/status', route((req) => write.setRequestStatus(req.businessId, idParam(req), req.body.status)));

api.get('/proposals', route((req) => read.listProposals(req.businessId, req.query.scope === 'sent' ? 'sent' : 'received')));
api.post('/proposals', route((req) => write.createProposal(req.businessId, req.body), 201));
api.patch('/proposals/:id/status', route((req) => write.setProposalStatus(req.businessId, idParam(req), req.body.status)));

api.get('/transactions', route((req) => read.listTransactions(req.businessId)));
api.patch('/transactions/:id/complete', route((req) => write.completeTransaction(req.businessId, idParam(req))));

api.get('/reviews', route(() => read.listReviews()));
api.post('/reviews', route((req) => write.createReview(req.businessId, req.body), 201));
