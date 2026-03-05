const pivotDimensionsService =
  require('../services/pivotDimensions.service');

exports.getDimensions = async (req, res) => {
  try {
    const { sitemap_uid, start_date, end_date, month } = req.query;

    if (!sitemap_uid) {
      return res.status(400).json({
        error: 'sitemap_uid is required',
      });
    }

    const dimensions =
      await pivotDimensionsService.getPivotDimensions({
        sitemap_uid,
        start_date,
        end_date,
        month,
      });

    res.json({ dimensions });
  } catch (err) {
    console.error('[Pivot Dimensions Error]', err);
    res.status(500).json({ error: err.message });
  }
};
