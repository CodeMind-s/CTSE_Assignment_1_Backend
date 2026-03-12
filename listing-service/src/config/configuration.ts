import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  MONGO_URI: Joi.string().required(),
  INTERNAL_SERVICE_KEY: Joi.string().required(),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
});
