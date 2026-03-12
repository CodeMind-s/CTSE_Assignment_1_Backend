import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3002),
  MONGO_URI: Joi.string().required(),
  INTERNAL_SERVICE_KEY: Joi.string().required(),
  LISTING_SERVICE_URL: Joi.string().required(),
  NOTIFICATION_SERVICE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
});
