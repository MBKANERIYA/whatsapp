import 'dotenv/config';
import mysql from 'mysql2/promise';

const pool = await mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME
});

console.log('=== All conversations ===');
const [all] = await pool.execute('SELECT id, tenant_id, phone, contact_name, is_archived FROM whatsapp_conversations');
console.log(JSON.stringify(all, null, 2));

console.log('\n=== is_archived = 0 filter ===');
const [filtered] = await pool.execute('SELECT id, tenant_id, phone, contact_name, is_archived FROM whatsapp_conversations WHERE is_archived = 0');
console.log(JSON.stringify(filtered, null, 2));

console.log('\n=== Full query (tenant_id=4) ===');
const [full] = await pool.query(
  `SELECT wc.*, c.name as matched_contact_name
   FROM whatsapp_conversations wc
   LEFT JOIN contacts c ON wc.contact_id = c.id
   WHERE wc.tenant_id = 4 AND wc.is_archived = 0
   ORDER BY wc.last_message_at DESC LIMIT 30 OFFSET 0`
);
console.log(JSON.stringify(full, null, 2));

console.log('\n=== Chat messages ===');
const [msgs] = await pool.execute('SELECT id, conversation_id, direction, body, status FROM whatsapp_chat_messages LIMIT 10');
console.log(JSON.stringify(msgs, null, 2));

await pool.end();
