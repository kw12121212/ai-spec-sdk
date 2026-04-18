import { CronExpressionParser } from 'cron-parser';
const last = new Date(Date.now() - 1000);
const now = new Date();
try {
  const iter = CronExpressionParser.parse('* * * * *', { currentDate: last, endDate: now });
  console.log("created!");
  iter.next();
  console.log("nexted!");
} catch(e: any) {
  console.log("no match", e.message);
}