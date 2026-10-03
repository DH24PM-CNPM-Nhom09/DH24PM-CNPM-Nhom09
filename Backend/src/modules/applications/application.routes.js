const express = require('express');
const { z } = require('zod');
const wrap = require('../../utils/asyncHandler');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const createSchema = z.object({ programId: z.number().int().positive() });
const listQuery = z.object({
  status: z.enum(['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED']).optional(),
});
const reviewSchema = z.object({
  decision: z.enum(['UNDER_REVIEW', 'APPROVED', 'REJECTED']),
  note: z.string().max(1000).optional(),
});

function createApplicationRouter({ service, auth }) {
  const r = express.Router();
  r.use(auth.authenticate);

  r.post('/', auth.requireRole('CANDIDATE'), wrap(async (req, res) => {
    const body = createSchema.parse(req.body);
    res.status(201).json(await service.create(req.user, body));
  }));

  r.get('/', wrap(async (req, res) => {
    res.json(await service.list(req.user, listQuery.parse(req.query)));
  }));

  r.get('/:id', wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.get(req.user, id));
  }));

  r.post('/:id/submit', auth.requireRole('CANDIDATE'), wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.submit(req.user, id));
  }));

  r.post('/:id/review', auth.requireRole('REVIEWER', 'ADMIN'), wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.review(req.user, id, reviewSchema.parse(req.body)));
  }));

  return r;
}

module.exports = { createApplicationRouter };
