const { validationResult } = require("express-validator");

function validate(req, res, next) {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  const first = errors.array()[0];
  return res.status(400).json({
    success: false,
    message: first.msg,
    errors: errors.array().map(function (item) {
      return { field: item.path, message: item.msg };
    })
  });
}

module.exports = validate;
