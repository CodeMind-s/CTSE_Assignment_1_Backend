import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  MONGO_URI: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  REFRESH_SECRET: Joi.string().required(),
  REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  INTERNAL_SERVICE_KEY: Joi.string().required(),
  LISTING_SERVICE_URL: Joi.string().required(),
  RESERVATION_SERVICE_URL: Joi.string().required(),
  NOTIFICATION_SERVICE_URL: Joi.string().required(),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
});
