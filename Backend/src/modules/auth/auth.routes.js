const express = require('express');
const { z } = require('zod');
const wrap = require('../../utils/asyncHandler');

const googleSchema = z.object({ idToken: z.string().min(10) });

function createAuthRouter({ service, auth }) {
  const r = express.Router();

  r.post('/google', wrap(async (req, res) => {
    const { idToken } = googleSchema.parse(req.body);
    res.json(await service.loginWithGoogle(idToken));
  }));

  r.get('/me', auth.authenticate, wrap(async (req, res) => {
    res.json(await service.getProfile(req.user.id));
  }));

  return r;
}

module.exports = { createAuthRouter };
