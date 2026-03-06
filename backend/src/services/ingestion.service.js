const db = require('../db');
const scraper = require('./scraper.service');
const normalizer = require('./normalization.service');

/**
 * 🔹 RAW SCRAPED JSON KEYS
 * (BEFORE normalization)
 */
const DIMENSION_FIELDS = [
  'manufacturer',
  'series',
  'Pitch',
  'Rows',
  'Positions',
  'Connector Type',
  'Mounting Type',
  'Product Status',
  'Termination',
  'package',
];

exports.ingestScrapeJob = async (scrapeJob) => {
  const client = await db.pool.connect();

  try {
    await client.query('BEGIN');

    // =====================================================
    // 1️⃣ SNAPSHOT — ONE PER DAY PER SITEMAP
    // =====================================================
    const snapshotRes = await client.query(
      `
      INSERT INTO snapshots (
        sitemap_id,
        scrape_job_id,
        snapshot_time,
        snapshot_date
      )
      VALUES ($1, $2, NOW(), CURRENT_DATE)
      ON CONFLICT (sitemap_id, snapshot_date)
      DO UPDATE SET
        scrape_job_id = EXCLUDED.scrape_job_id,
        snapshot_time = NOW()
      RETURNING id
      `,
      [scrapeJob.sitemap_id, scrapeJob.id]
    );

    const snapshotId = snapshotRes.rows[0].id;

    // =====================================================
    // 🧹 IMPORTANT: CLEAR EXISTING DATA FOR THIS SNAPSHOT
    // (Idempotent re-ingestion)
    // =====================================================
   // 🧹 Clear existing snapshot data (idempotent re-run)
await client.query(
  `DELETE FROM snapshot_dimensions WHERE snapshot_id = $1`,
  [snapshotId]
);

await client.query(
  `DELETE FROM snapshot_facts WHERE snapshot_id = $1`,
  [snapshotId]
);

await client.query(
  `DELETE FROM raw_scrape_data WHERE snapshot_id = $1`,
  [snapshotId]
);


    // =====================================================
    // 2️⃣ FETCH SCRAPED DATA
    // =====================================================
    const rows = await scraper.getScrapedData(scrapeJob.scraper_job_id);

    // If sitemap name is missing, backfill it from scraped payload.
    // Note: `description` is product-level text; we use the first available value.
    const scrapedDescription = rows.find((row) => (
      typeof row?.description === 'string' && row.description.trim()
    ))?.description?.trim();

    if (scrapedDescription) {
      await client.query(
        `
        UPDATE sitemaps
        SET name = $2
        WHERE id = $1
        `,
        [scrapeJob.sitemap_id, scrapedDescription]
      );
    }

    let rowCount = 0;
    const seenRowHashes = new Set();

    for (const row of rows) {
      const rowHash = normalizer.hashRow(row);

      // Skip duplicate rows within the same scrape payload.
      if (seenRowHashes.has(rowHash)) {
        continue;
      }
      seenRowHashes.add(rowHash);

      // =====================================================
      // 4️⃣ RAW SCRAPE STORAGE
      // =====================================================
      await client.query(
        `
        INSERT INTO raw_scrape_data (
          snapshot_id,
          raw_payload,
          row_hash
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (snapshot_id, row_hash)
        DO UPDATE SET raw_payload = EXCLUDED.raw_payload
        `,
        [snapshotId, row, rowHash]
      );

      // =====================================================
      // 5️⃣ PRODUCT RESOLUTION
      // =====================================================
      const productRes = await client.query(
        `
        INSERT INTO products (
          sitemap_id,
          product_key,
          product_url
        )
        VALUES ($1, $2, $3)
        ON CONFLICT (sitemap_id, product_key)
        DO UPDATE SET product_key = EXCLUDED.product_key
        RETURNING id
        `,
        [
          scrapeJob.sitemap_id,
          rowHash,
          row['web-scraper-start-url'] ?? null,
        ]
      );

      const productId = productRes.rows[0].id;

      // =====================================================
      // 6️⃣ NORMALIZED FACTS
      // =====================================================
      const fact = normalizer.normalizeRow(row);

      await client.query(
        `
        INSERT INTO snapshot_facts (
          snapshot_id,
          sitemap_id,
          product_id,
          manufacturer,
          series,
          product_type,
          pitch,
          rows,
          positions,
          quantity,
          price
        )
        VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
        )
        `,
        [
          snapshotId,
          scrapeJob.sitemap_id,
          productId,
          fact.manufacturer,
          fact.series,
          fact.product_type,
          fact.pitch,
          fact.rows,
          fact.positions,
          fact.quantity,
          fact.price,
        ]
      );

      // =====================================================
      // 7️⃣ SNAPSHOT DIMENSIONS (DYNAMIC)
      // =====================================================
      for (const field of DIMENSION_FIELDS) {
        const rawValue = row[field];

        if (!rawValue || rawValue === '-' || rawValue === '') continue;

        const dimensionKey = normalizer.normalizeDimensionKey(field);

        await client.query(
          `
          INSERT INTO snapshot_dimensions (
            snapshot_id,
            product_id,
            dimension,
            value
          )
          VALUES ($1, $2, $3, $4)
          `,
          [
            snapshotId,
            productId,
            dimensionKey,
            String(rawValue).trim(),
          ]
        );
      }

      rowCount++;
    }

    // =====================================================
    // 8️⃣ FINALIZE SNAPSHOT
    // =====================================================
    await client.query(
      `
      UPDATE snapshots
      SET row_count = $1
      WHERE id = $2
      `,
      [rowCount, snapshotId]
    );

    // =====================================================
    // 9️⃣ MARK JOB FINISHED
    // =====================================================
    await client.query(
      `
      UPDATE scrape_jobs
      SET status = 'finished',
          finished_at = NOW()
      WHERE id = $1
      `,
      [scrapeJob.id]
    );

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');

    await db.query(
      `
      UPDATE scrape_jobs
      SET status = 'failed',
          error_message = $2
      WHERE id = $1
      `,
      [scrapeJob.id, err.message]
    );

    throw err;
  } finally {
    client.release();
  }
};
