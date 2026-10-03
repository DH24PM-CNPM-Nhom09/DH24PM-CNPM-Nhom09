const express = require('express');
const { z } = require('zod');
const wrap = require('../../utils/asyncHandler');

const idParam = z.object({ id: z.coerce.number().int().positive() });
const createSchema = z.object({ method: z.enum(['BANK_TRANSFER', 'CARD', 'E_WALLET']) });

function createPaymentRouter({ service, auth }) {
  const r = express.Router();
  r.use(auth.authenticate);

  r.post('/applications/:id/payments', auth.requireRole('CANDIDATE'), wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    const body = createSchema.parse(req.body);
    res.status(201).json(await service.create(req.user, id, body));
  }));

  r.post('/payments/:id/confirm', auth.requireRole('STAFF', 'ADMIN'), wrap(async (req, res) => {
    const { id } = idParam.parse(req.params);
    res.json(await service.confirm(id));
  }));

  return r;
}

module.exports = { createPaymentRouter };
