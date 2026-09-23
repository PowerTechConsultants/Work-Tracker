import db, { uuid, getSetting, setSetting } from '../db/index.js';
import { getISTDate, parseUTC, isSundayIST } from './time.js';
const LEAVE_BALANCE = { casual: 8, sick: 8, proposal: 16 };
async function proposalUsedInYear(userId, year) {
    const start = `${year}-01-01`;
    const end = `${year}-12-31`;
    const rows = await db.prepare("SELECT start_date, end_date FROM leaves WHERE user_id = ? AND type = 'proposal' AND status = 'approved' AND start_date <= ? AND end_date >= ?").all(userId, end, start);
    let total = 0;
    for (const r of rows) {
        const clampStart = r.start_date > start ? r.start_date : start;
        const clampEnd = r.end_date < end ? r.end_date : end;
        total += await countWorkingDays(userId, clampStart, clampEnd);
    }
    return total;
}
async function countWorkingDays(userId, start, end) {
    const cur = new Date(`${start}T00:00:00Z`);
    const endD = new Date(`${end}T00:00:00Z`);
    const excluded = await getExcludedDates(userId, start, end);
    let count = 0;
    while (cur <= endD) {
        const iso = cur.toISOString().split('T')[0];
        if (isSundayIST(iso)) {
            cur.setUTCDate(cur.getUTCDate() + 1);
            continue;
        }
        if (!excluded.has(iso))
            count++;
        cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return count;
}
async function getExcludedDates(userId, start, end) {
    const excluded = new Set();
    const holidays = await db.prepare('SELECT id, date FROM holidays WHERE date BETWEEN ? AND ?').all(start, end);
    const holidayIds = holidays.map((h) => h.id);
    const userAssignees = new Set();
    const allAssigneeHolidays = new Set();
    if (holidayIds.length > 0) {
        const ph = holidayIds.map(() => '?').join(',');
        const assignees = await db.prepare(`SELECT holiday_id, user_id FROM holiday_assignees WHERE holiday_id IN (${ph})`).all(...holidayIds);
        for (const a of assignees) {
            allAssigneeHolidays.add(a.holiday_id);
            if (a.user_id === userId)
                userAssignees.add(a.holiday_id);
        }
    }
    for (const h of holidays) {
        if (userAssignees.has(h.id)) {
            excluded.add(h.date);
            continue;
        }
        if (!allAssigneeHolidays.has(h.id))
            excluded.add(h.date);
    }
    return excluded;
}
async function proposalEntitlement(userId, year) {
    const user = await db.prepare('SELECT joining_date FROM users WHERE id = ?').get(userId);
    const joiningDate = user?.joining_date;
    if (!joiningDate)
        return LEAVE_BALANCE.proposal;
    const join = parseUTC(joiningDate);
    if (isNaN(join.getTime()))
        return LEAVE_BALANCE.proposal;
    const joinYear = join.getUTCFullYear();
    if (joinYear < year)
        return LEAVE_BALANCE.proposal;
    if (joinYear > year)
        return 0;
    const joinMonth = join.getUTCMonth() + 1;
    const joinQuarter = Math.ceil(joinMonth / 3);
    const remainingQuarters = 5 - joinQuarter;
    return remainingQuarters * 4; // 4 proposal days per quarter
}
async function computeCarryforward(userId, prevYear) {
    const entitlement = await proposalEntitlement(userId, prevYear);
    if (entitlement === 0)
        return 0;
    const used = await proposalUsedInYear(userId, prevYear);
    return Math.max(0, entitlement - used);
}
export async function runAnnualLeaveReset() {
    const today = getISTDate();
    const currentYear = parseInt(today.slice(0, 4), 10);
    const prevYear = currentYear - 1;
    const lastResetYear = await getSetting('leave_annual_reset_year');
    if (lastResetYear && parseInt(lastResetYear, 10) >= currentYear) {
        console.log(`[Leave-Reset] Already processed for ${currentYear}, skipping`);
        return;
    }
    console.log(`[Leave-Reset] Running annual carry forward: ${prevYear} → ${currentYear}`);
    const activeUsers = await db.prepare("SELECT id, first_name, last_name, employee_id FROM users WHERE status = 'active'").all();
    let processed = 0;
    let carriedForward = 0;
    const runUser = db.transaction(async (user) => {
        const cf = await computeCarryforward(user.id, prevYear);
        if (cf > 0) {
            const id = uuid();
            await db.prepare("INSERT INTO leave_carryforwards (id, user_id, year, prev_year, proposal_carryforward) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE proposal_carryforward = VALUES(proposal_carryforward)").run(id, user.id, currentYear, prevYear, cf);
            carriedForward++;
        }
        processed++;
    });
    for (const user of activeUsers) {
        try {
            await runUser(user);
        }
        catch (e) {
            console.error(`[Leave-Reset] Failed for user ${user.employee_id}:`, e.message);
        }
    }
    await setSetting('leave_annual_reset_year', String(currentYear));
    console.log(`[Leave-Reset] Complete: ${processed} users processed, ${carriedForward} with carry forward`);
}
