// Quick CLI database viewer for ServicePath AI.
// Usage:
//   node view_db.js               -> lists all tables and views with row counts
//   node view_db.js <table_name>  -> displays rows of that table in a formatted table
//   node view_db.js "<sql_query>" -> executes custom SQL query and shows result table
import { pool } from './backend/src/db.js';

const target = process.argv[2];

async function main() {
  try {
    if (!target) {
      console.log('\n--- ServicePath AI Database Overview ---\n');
      const [tables] = await pool.query('SHOW FULL TABLES;');
      const results = [];
      for (const row of tables) {
        const tableName = Object.values(row)[0];
        const tableType = Object.values(row)[1] || 'TABLE';
        try {
          const [[{ count }]] = await pool.query(`SELECT COUNT(*) AS count FROM \`${tableName}\``);
          results.push({ Name: tableName, Type: tableType, 'Row Count': count });
        } catch {
          results.push({ Name: tableName, Type: tableType, 'Row Count': 'N/A' });
        }
      }
      console.table(results);
      console.log('\nTip: Run "node view_db.js <tableName>" to view table data, e.g.:');
      console.log('  node view_db.js business');
      console.log('  node view_db.js request');
      console.log('  node view_db.js v_request_summary\n');
      return;
    }

    if (target.toUpperCase().startsWith('SELECT') || target.toUpperCase().startsWith('SHOW') || target.toUpperCase().startsWith('DESC')) {
      const [rows] = await pool.query(target);
      console.log(`\n--- Result for: "${target}" ---\n`);
      if (!rows.length) {
        console.log('0 rows returned.');
      } else {
        console.table(rows);
      }
      return;
    }

    const tableName = target.replace(/`/g, '');
    const [rows] = await pool.query(`SELECT * FROM \`${tableName}\` LIMIT 50;`);
    console.log(`\n--- Table: ${tableName} (${rows.length} rows) ---\n`);
    if (!rows.length) {
      console.log('Table is currently empty.');
    } else {
      console.table(rows);
    }
  } catch (err) {
    console.error('Error viewing database:', err.message);
  } finally {
    await pool.end();
  }
}

main();

