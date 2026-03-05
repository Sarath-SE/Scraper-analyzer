const db = require('../db');
const sqlBuilder = require('../services/pivotSqlBuilder.service');
const { buildPivotResult } = require('../services/pivotResult.service');

exports.runPivot = async (req, res) => {
  try {
    const {
      rows: rowDims,
      columns: colDims,
      measures,
      filters,
    } = req.body;

    if (!filters?.sitemap_uid) {
      throw new Error('sitemap_uid is required');
    }

    const sitemapRes = await db.query(
      `SELECT id FROM sitemaps WHERE sitemap_uid = $1`,
      [filters.sitemap_uid]
    );

    if (sitemapRes.rows.length === 0) {
      throw new Error('Invalid sitemap_uid');
    }

    const sitemapId = sitemapRes.rows[0].id;

    const sql = sqlBuilder.buildPivotQuery({
      rows: rowDims,
      columns: colDims,
      measures,
      filters: {
        sitemap_id: sitemapId,
        start_date: filters.start_date,
        end_date: filters.end_date,
        month: filters.month,
      },
    });

    const result = await db.query(sql);

    const pivot = buildPivotResult(result.rows, rowDims, colDims[0], measures);

    res.json({ data: pivot });
  } catch (err) {
    console.error('[Pivot Error]', err);
    res.status(400).json({ error: err.message });
  }
};
