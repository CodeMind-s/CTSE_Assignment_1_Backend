import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  PORT: Joi.number().default(3003),
  MONGO_URI: Joi.string().required(),
  INTERNAL_SERVICE_KEY: Joi.string().required(),
  SMTP_HOST: Joi.string().required(),
  SMTP_PORT: Joi.number().default(587),
  SMTP_USER: Joi.string().required(),
  SMTP_PASS: Joi.string().required(),
  SMTP_FROM: Joi.string().required(),
  ALLOWED_ORIGINS: Joi.string().default('http://localhost:3000'),
});
