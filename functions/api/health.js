export async function onRequest(context) {
  const { request, env } = context;

  // 调试：检查 DB 是否存在
  if (!env.DB) {
    return new Response(JSON.stringify({ error: 'DB binding not found' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/health/, '') || '/';

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers });
  }

  try {
    let body = null;
    if (request.method === 'POST') {
      body = await request.json();
    }

    let result;
    const recordId = path.split('/').filter(Boolean)[0];

    switch (request.method) {
      case 'GET': {
        const stmt = env.DB.prepare('SELECT * FROM health_records ORDER BY date DESC');
        const { results } = await stmt.all();
        result = { data: results };
        break;
      }
      case 'POST': {
        const record = body;
        const stmt = env.DB.prepare(`
          INSERT INTO health_records (
            date, hospital, doctor, purpose, symptoms, weight, other_metric,
            cost_registration, cost_exam, cost_drug, cost_transport,
            thoughts, next_review, schedule_days, schedule_period, medications, images
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          RETURNING *
        `);
        const inserted = await stmt.bind(
          record.date, record.hospital, record.doctor, record.purpose || '',
          record.symptomReason || '', record.weight || '', record.other_metric || '',
          record.costRegistration || 0, record.costExam || 0, record.costDrug || 0, record.costTransport || 0,
          record.feelings || '', record.nextVisit || '',
          JSON.stringify(record.scheduleDays || []), record.schedulePeriod || '上午',
          JSON.stringify(record.medications || []), JSON.stringify(record.images || [])
        ).first();
        result = { data: inserted };
        break;
      }
      case 'DELETE': {
        if (recordId) {
          const stmt = env.DB.prepare('DELETE FROM health_records WHERE id = ?');
          await stmt.bind(recordId).run();
          result = { success: true };
        } else {
          const stmt = env.DB.prepare('DELETE FROM health_records');
          await stmt.run();
          result = { success: true };
        }
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers });
    }

    return new Response(JSON.stringify(result), { headers });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers });
  }
}
