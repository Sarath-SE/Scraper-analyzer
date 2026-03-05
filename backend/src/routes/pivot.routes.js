const express = require('express');
const router = express.Router();

const pivotController = require('../controllers/pivot.controller');
const pivotDimensionsController =
  require('../controllers/pivotDimensions.controller');

router.post('/run', pivotController.runPivot);
router.get('/dimensions', pivotDimensionsController.getDimensions);

module.exports = router;
