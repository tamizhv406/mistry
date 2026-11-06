import React, { useState, useMemo, useEffect } from 'react';
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  Copy,
  Check,
  FileText,
  Users,
  Search,
  Sparkles,
  ArrowRight,
  X,
  Phone,
  User as UserIcon,
  IndianRupee,
  Layers,
  Save,
  HelpCircle,
} from 'lucide-react';
import type { AttendanceRecord, AttendanceStatus, LabourAdvance, LabourWorker, SalaryPayment, Site, User } from '../../db/types';
import { useLanguage, isValidIndianPhone, cleanPhoneNumber } from '../../services/i18n';
import { markAttendance } from '../../services/records';
import { generateWorkerPayslipPdfBlob, downloadFile } from '../../utils/pdfGenerator';
import { formatDay, todayKey, addDays } from '../../utils/datetime';
import { storageService } from '../../services/storage';

interface AttendanceMatrixProps {
  user: User;
  activeSite: Site;
  workers: LabourWorker[];
  attendance: AttendanceRecord[];
  advances: LabourAdvance[];
  salaryPayments: SalaryPayment[];
  onNotify: (msg: string, type?: 'success' | 'error' | 'info') => void;
  onOpenWorkerModal?: (worker?: LabourWorker) => void;
}

export const AttendanceMatrix: React.FC<AttendanceMatrixProps> = ({
  user,
  activeSite,
  workers,
  attendance,
  advances,
  salaryPayments,
  onNotify,
  onOpenWorkerModal,
}) => {
  const { lang, t, roleLabel, statusLabel } = useLanguage();

  // Navigation: base date for the 7-day window (defaults to today - 6 days or current week)
  const [windowStartDate, setWindowStartDate] = useState<string>(() => {
    // Show 7 days ending with today (or starting 6 days ago)
    return addDays(todayKey(), -6);
  });

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [busyWorkerDay, setBusyWorkerDay] = useState<string | null>(null);
  const [bulkBusy, setBulkBusy] = useState<boolean>(false);

  // OT Hours Prompt Modal
  const [otPrompt, setOtPrompt] = useState<{
    isOpen: boolean;
    worker: LabourWorker | null;
    date: string;
    hours: number;
  }>({
    isOpen: false,
    worker: null,
    date: '',
    hours: 2,
  });

  // Payslip Modal State
  const [payslipModal, setPayslipModal] = useState<{
    isOpen: boolean;
    worker: LabourWorker | null;
    startDate: string;
    endDate: string;
  }>({
    isOpen: false,
    worker: null,
    startDate: '',
    endDate: '',
  });

  const [copiedPayslip, setCopiedPayslip] = useState<boolean>(false);

  // Array of 7 dates for the current matrix window
  const windowDates: string[] = useMemo(() => {
    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      dates.push(addDays(windowStartDate, i));
    }
    return dates;
  }, [windowStartDate]);

  // Navigate window
  const handleShiftDays = (delta: number) => {
    setWindowStartDate(prev => addDays(prev, delta));
  };

  const handleResetToCurrentWeek = () => {
    setWindowStartDate(addDays(todayKey(), -6));
  };

  // Map of "workerId_date" -> AttendanceRecord
  const attendanceMap = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    attendance.forEach(a => {
      if (!a.isDeleted) {
        map.set(`${a.workerId}_${a.date}`, a);
      }
    });
    return map;
  }, [attendance]);

  // Advances map per worker
  const advancesMap = useMemo(() => {
    const map = new Map<string, number>();
    advances.forEach(adv => {
      if (!adv.isDeleted && adv.advanceType === 'Recoverable') {
        const cur = map.get(adv.workerId) || 0;
        map.set(adv.workerId, cur + Number(adv.amount || 0));
      }
    });
    return map;
  }, [advances]);

  // Unique roles for filter dropdown
  const uniqueRoles = useMemo(() => {
    const set = new Set<string>();
    workers.forEach(w => {
      if (w.category) set.add(w.category);
    });
    return Array.from(set);
  }, [workers]);

  // Filtered workers list
  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      if (w.isDeleted) return false;
      if (roleFilter !== 'all' && w.category !== roleFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          w.name.toLowerCase().includes(q) ||
          (w.category || '').toLowerCase().includes(q) ||
          (w.phone || '').includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [workers, roleFilter, searchQuery]);

  // 1-Tap Quick Status Cycle:
  // Unmarked -> 'present' (P, 1.0) -> 'half_day' (H, 0.5) -> 'absent' (A, 0.0) -> 'overtime' (OT) -> Unmarked
  const handleCellClick = async (worker: LabourWorker, date: string) => {
    const key = `${worker.id}_${date}`;
    if (busyWorkerDay === key) return;

    const existing = attendanceMap.get(key);
    const currentStatus = existing ? existing.status : null;

    if (!currentStatus) {
      // Cycle to Present
      await executeMark(worker, date, 'present');
    } else if (currentStatus === 'present') {
      // Cycle to Half-day
      await executeMark(worker, date, 'half_day');
    } else if (currentStatus === 'half_day') {
      // Cycle to Absent
      await executeMark(worker, date, 'absent');
    } else if (currentStatus === 'absent') {
      // Cycle to Overtime prompt modal
      setOtPrompt({
        isOpen: true,
        worker,
        date,
        hours: existing?.overtimeHours || 2,
      });
    } else {
      // From Overtime or Leave, cycle back to Present or clear
      await executeMark(worker, date, 'present');
    }
  };

  const executeMark = async (
    worker: LabourWorker,
    date: string,
    status: AttendanceStatus,
    otHours?: number
  ) => {
    const key = `${worker.id}_${date}`;
    setBusyWorkerDay(key);
    try {
      const res = await markAttendance(user, activeSite.id, worker, date, status, undefined);
      if (!res.ok) {
        onNotify(res.error, 'error');
      } else {
        // Also persist into storageService for zero-loss backup
        const otVal = status === 'overtime' ? (otHours || 2) : 0;
        await storageService.saveAttendance({
          id: res.value.id,
          workerId: worker.id,
          siteId: activeSite.id,
          date,
          status: status === 'present' ? 'P' : status === 'half_day' ? 'H' : status === 'absent' ? 'A' : 'OT',
          otHours: otVal,
        }).catch(() => {});
      }
    } catch (err: any) {
      onNotify(err.message || 'Error updating attendance', 'error');
    } finally {
      setBusyWorkerDay(null);
    }
  };

  // Submit Overtime Hours
  const handleConfirmOT = async () => {
    if (!otPrompt.worker || !otPrompt.date) return;
    const hours = Math.max(0.5, Math.min(12, Number(otPrompt.hours) || 2));
    await executeMark(otPrompt.worker, otPrompt.date, 'overtime', hours);
    setOtPrompt({ isOpen: false, worker: null, date: '', hours: 2 });
  };

  // Bulk Action 1: Mark All Present Today
  const handleMarkAllPresentToday = async () => {
    if (bulkBusy || filteredWorkers.length === 0) return;
    setBulkBusy(true);
    const today = todayKey();
    let count = 0;
    try {
      for (const w of filteredWorkers) {
        const key = `${w.id}_${today}`;
        const existing = attendanceMap.get(key);
        if (!existing || existing.status !== 'present') {
          await markAttendance(user, activeSite.id, w, today, 'present');
          count++;
        }
      }
      onNotify(
        lang === 'ta'
          ? `${count} பணியாளர்களுக்கு இன்று முழு நாள் குறிக்கப்பட்டது!`
          : `Marked ${count} worker(s) Present for today!`,
        'success'
      );
    } catch {
      onNotify('Bulk mark failed', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  // Bulk Action 2: Copy Yesterday's Attendance
  const handleCopyYesterdayAttendance = async () => {
    if (bulkBusy || filteredWorkers.length === 0) return;
    setBulkBusy(true);
    const today = todayKey();
    const yesterday = addDays(today, -1);
    let copied = 0;

    try {
      for (const w of filteredWorkers) {
        const yestRecord = attendanceMap.get(`${w.id}_${yesterday}`);
        if (yestRecord && !yestRecord.isDeleted) {
          await markAttendance(user, activeSite.id, w, today, yestRecord.status, yestRecord.notes);
          copied++;
        }
      }
      onNotify(
        lang === 'ta'
          ? `நேற்றைய வருகை அடிப்படையில் ${copied} பணியாளர்களுக்கு நகலெடுக்கப்பட்டது!`
          : `Copied yesterday's attendance for ${copied} worker(s)!`,
        'success'
      );
    } catch {
      onNotify('Failed to copy yesterday attendance', 'error');
    } finally {
      setBulkBusy(false);
    }
  };

  // Worker Statistics for the active 7-day window
  const getWorkerStats = (workerId: string, dailyWage: number) => {
    let pCount = 0;
    let hCount = 0;
    let aCount = 0;
    let otHoursTotal = 0;

    windowDates.forEach(d => {
      const rec = attendanceMap.get(`${workerId}_${d}`);
      if (rec && !rec.isDeleted) {
        if (rec.status === 'present') pCount++;
        else if (rec.status === 'half_day') hCount++;
        else if (rec.status === 'absent') aCount++;
        else if (rec.status === 'overtime') {
          pCount++; // OT includes full day + extra hours
          otHoursTotal += rec.overtimeHours || 2;
        }
      }
    });

    const hourlyRate = Math.round((dailyWage / 8) * 1.5);
    const grossWage = Math.round(
      pCount * dailyWage + hCount * 0.5 * dailyWage + otHoursTotal * hourlyRate
    );
    const advanceTaken = advancesMap.get(workerId) || 0;
    const netPayout = Math.max(0, grossWage - advanceTaken);

    return {
      pCount,
      hCount,
      aCount,
      otHoursTotal,
      hourlyRate,
      grossWage,
      advanceTaken,
      netPayout,
    };
  };

  // Format INR currency
  const formatINR = (val: number) =>
    '₹' + Math.round(val).toLocaleString('en-IN');

  // Open Payslip Modal for a worker
  const handleOpenPayslip = (worker: LabourWorker) => {
    setPayslipModal({
      isOpen: true,
      worker,
      startDate: windowDates[0],
      endDate: windowDates[6],
    });
  };

  // Active Payslip calculations
  const payslipData = useMemo(() => {
    if (!payslipModal.worker) return null;
    const w = payslipModal.worker;
    const stats = getWorkerStats(w.id, w.dailyWage);
    const periodStr = `${formatDay(payslipModal.startDate)} – ${formatDay(payslipModal.endDate)}`;
    return {
      worker: w,
      periodStr,
      ...stats,
    };
  }, [payslipModal, attendanceMap, advancesMap, windowDates]);

  // Export Payslip to PDF
  const handlePrintPayslipPdf = () => {
    if (!payslipData) return;
    try {
      const blob = generateWorkerPayslipPdfBlob({
        workerName: payslipData.worker.name,
        workerRole: roleLabel(payslipData.worker.category),
        workerPhone: payslipData.worker.phone,
        workerId: payslipData.worker.id,
        siteName: activeSite.name,
        periodStr: payslipData.periodStr,
        dailyWage: payslipData.worker.dailyWage,
        fullDays: payslipData.pCount,
        halfDays: payslipData.hCount,
        otHours: payslipData.otHoursTotal,
        otHourlyRate: payslipData.hourlyRate,
        grossWage: payslipData.grossWage,
        advanceDeducted: payslipData.advanceTaken,
        netPayout: payslipData.netPayout,
        preparedBy: user.fullName || user.username,
      });
      const fname = `Payslip_${payslipData.worker.name.replace(/\s+/g, '_')}_${payslipModal.startDate}.pdf`;
      downloadFile(blob, fname);
      onNotify('Worker payslip PDF generated successfully', 'success');
    } catch (e) {
      console.error(e);
      onNotify('Failed to generate payslip PDF', 'error');
    }
  };

  // Send Payslip via WhatsApp
  const handleSendWhatsAppSlip = () => {
    if (!payslipData) return;
    const w = payslipData.worker;
    const phone = cleanPhoneNumber(w.phone);
    const msg = [
      `*BUILDING MISTRY — WAGE PAYSLIP / சம்பள ரசீது*`,
      `═════════════════════════════════`,
      `👤 *Worker / பணியாளர்:* ${w.name}`,
      `🛠️ *Role / வேலை:* ${roleLabel(w.category)}`,
      `🏗️ *Site / தளம்:* ${activeSite.name}`,
      `📅 *Period / காலம்:* ${payslipData.periodStr}`,
      ``,
      `💵 *Daily Wage / தினக்கூலி:* ${formatINR(w.dailyWage)}/day`,
      `⏱️ *OT Hourly Rate:* ${formatINR(payslipData.hourlyRate)}/hr`,
      ``,
      `📊 *ATTENDANCE BREAKDOWN:*`,
      `• Full Days (முழு நாள்): ${payslipData.pCount} days`,
      `• Half Days (அரை நாள்): ${payslipData.hCount} days`,
      `• Overtime (கூடுதல் நேரம்): ${payslipData.otHoursTotal} hrs`,
      ``,
      `💰 *Gross Wages (மொத்த கூலி):* ${formatINR(payslipData.grossWage)}`,
      `📉 *Advance Deducted (கழித்த முன்பணம்):* (-) ${formatINR(payslipData.advanceTaken)}`,
      `═════════════════════════════════`,
      `💵 *NET CASH IN HAND (கையில் கொடுத்த நிகர கூலி):* *${formatINR(payslipData.netPayout)}*`,
      `═════════════════════════════════`,
      `_Issued by ${user.fullName || user.username} via Building Mistry ERP_`,
    ].join('\n');

    const url = phone.length === 10
      ? `https://wa.me/91${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;

    window.open(url, '_blank');
  };

  // Copy Payslip text
  const handleCopySlipText = async () => {
    if (!payslipData) return;
    const w = payslipData.worker;
    const msg = [
      `*BUILDING MISTRY — WAGE PAYSLIP / சம்பள ரசீது*`,
      `Worker: ${w.name} (${roleLabel(w.category)})`,
      `Site: ${activeSite.name} | Period: ${payslipData.periodStr}`,
      `Daily Wage: ${formatINR(w.dailyWage)}`,
      `Worked: ${payslipData.pCount} Full, ${payslipData.hCount} Half, ${payslipData.otHoursTotal} OT hrs`,
      `Gross Wages: ${formatINR(payslipData.grossWage)}`,
      `Advance Deducted: (-) ${formatINR(payslipData.advanceTaken)}`,
      `NET PAYABLE: ${formatINR(payslipData.netPayout)}`,
    ].join('\n');

    try {
      await navigator.clipboard.writeText(msg);
      setCopiedPayslip(true);
      onNotify('Payslip copied to clipboard', 'success');
      setTimeout(() => setCopiedPayslip(false), 2500);
    } catch {
      onNotify('Could not copy', 'error');
    }
  };

  // Get weekday name (Mon, Tue, etc.)
  const getWeekdayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    const dayIndex = d.getDay();
    const daysEn = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const daysTa = ['ஞாயிறு', 'திங்கள்', 'செவ்வாய்', 'புதன்', 'வியாழன்', 'வெள்ளி', 'சனி'];
    return lang === 'ta' ? daysTa[dayIndex] : daysEn[dayIndex];
  };

  return (
    <div className="space-y-4">
      {/* ── Top Bulk Action Bar & Week Range Navigator ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
          {/* Week Selector / Range Navigator */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={() => handleShiftDays(-7)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs transition"
                title={t('prev_week')}
              >
                <ChevronLeft size={16} />
              </button>

              <div className="px-3 py-1 text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                <Calendar size={14} className="text-indigo-600" />
                <span>
                  {formatDay(windowDates[0])} – {formatDay(windowDates[6])}
                </span>
              </div>

              <button
                type="button"
                onClick={() => handleShiftDays(7)}
                className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 hover:shadow-2xs transition"
                title={t('next_week')}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <button
              type="button"
              onClick={handleResetToCurrentWeek}
              className="px-3 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 transition"
            >
              {t('today')}
            </button>
          </div>

          {/* Rapid Bulk Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Mark All Present Today */}
            <button
              type="button"
              onClick={handleMarkAllPresentToday}
              disabled={bulkBusy || filteredWorkers.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition"
            >
              <CheckCircle2 size={15} />
              <span>{t('mark_all_present')}</span>
            </button>

            {/* Copy Yesterday's Marks */}
            <button
              type="button"
              onClick={handleCopyYesterdayAttendance}
              disabled={bulkBusy || filteredWorkers.length === 0}
              className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition"
            >
              <Copy size={14} />
              <span>{t('copy_yesterday')}</span>
            </button>
          </div>
        </div>

        {/* Filters Bar: Search & Role Selector */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_worker')}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              {t('role')}:
            </span>
            <select
              value={roleFilter}
              onChange={e => setRoleFilter(e.target.value)}
              className="text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none"
            >
              <option value="all">{lang === 'ta' ? 'அனைத்து வேலைகளும்' : 'All Trades'}</option>
              {uniqueRoles.map(r => (
                <option key={r} value={r}>
                  {roleLabel(r)}
                </option>
              ))}
            </select>

            {/* Quick Status Legend Pill */}
            <div className="hidden sm:flex items-center gap-2 text-[10px] font-extrabold bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <span className="flex items-center gap-1 text-emerald-600">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> P (1.0)
              </span>
              <span className="flex items-center gap-1 text-amber-600">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> H (0.5)
              </span>
              <span className="flex items-center gap-1 text-rose-600">
                <span className="w-2 h-2 rounded-full bg-rose-500" /> A (0.0)
              </span>
              <span className="flex items-center gap-1 text-purple-600">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> OT
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. The Attendance Spreadsheet Matrix (Sticky First Column) ── */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto relative">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold">
                {/* STICKY FIRST COLUMN HEADER */}
                <th
                  style={{ position: 'sticky', left: 0, zIndex: 20 }}
                  className="bg-slate-100 dark:bg-slate-800 px-3.5 py-3 w-56 min-w-[200px] border-r border-slate-200 dark:border-slate-700 shadow-xs"
                >
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-200">
                    {t('worker_details')}
                  </div>
                </th>

                {/* 7-Day Window Date Headers */}
                {windowDates.map(dateStr => {
                  const isToday = dateStr === todayKey();
                  const weekday = getWeekdayName(dateStr);
                  const dayNum = dateStr.slice(-2);
                  return (
                    <th
                      key={dateStr}
                      className={`text-center py-2.5 px-1 min-w-[58px] border-r border-slate-200/60 dark:border-slate-700/60 ${
                        isToday ? 'bg-indigo-50/70 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300' : ''
                      }`}
                    >
                      <div className="text-[10px] font-extrabold uppercase leading-none">{weekday}</div>
                      <div className={`text-xs font-black mt-1 ${isToday ? 'text-indigo-600' : 'text-slate-800 dark:text-slate-200'}`}>
                        {dayNum}
                      </div>
                    </th>
                  );
                })}

                {/* Summary Metrics Headers */}
                <th className="py-2.5 px-2 text-center text-[10px] font-bold text-slate-500 uppercase border-r border-slate-200/60">
                  {lang === 'ta' ? 'நாட்கள்' : 'Days'}
                </th>
                <th className="py-2.5 px-2 text-right text-[10px] font-bold text-slate-500 uppercase border-r border-slate-200/60">
                  {t('gross_wage')}
                </th>
                <th className="py-2.5 px-2 text-right text-[10px] font-bold text-slate-500 uppercase border-r border-slate-200/60">
                  {t('advance_deduction')}
                </th>
                <th className="py-2.5 px-2 text-right text-[10px] font-bold text-slate-500 uppercase border-r border-slate-200/60">
                  {t('net_payout')}
                </th>
                <th className="py-2.5 px-3 text-center text-[10px] font-bold text-slate-500 uppercase">
                  {t('action')}
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
              {filteredWorkers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="py-12 text-center text-slate-400">
                    <Users size={32} className="mx-auto mb-2 opacity-40" />
                    <div>{lang === 'ta' ? 'பணியாளர்கள் எவரும் இல்லை' : 'No personnel found'}</div>
                  </td>
                </tr>
              ) : (
                filteredWorkers.map(w => {
                  const stats = getWorkerStats(w.id, w.dailyWage);

                  return (
                    <tr
                      key={w.id}
                      className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors"
                    >
                      {/* STICKY FIRST COLUMN: Worker info, trade badge, daily wage */}
                      <td
                        style={{ position: 'sticky', left: 0, zIndex: 10 }}
                        className="bg-white dark:bg-slate-900 px-3.5 py-2.5 border-r border-slate-200 dark:border-slate-700 shadow-xs"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">
                            {w.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 pr-1">
                            <div className="font-extrabold text-slate-900 dark:text-slate-100 truncate text-xs">
                              {w.name}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-1.5 py-0.2 rounded">
                                {roleLabel(w.category)}
                              </span>
                              <span className="text-[10px] text-slate-400 font-bold">
                                ₹{w.dailyWage}
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* 7 Interactive Day Cells with 1-Tap Quick Cycle */}
                      {windowDates.map(dateStr => {
                        const cellKey = `${w.id}_${dateStr}`;
                        const record = attendanceMap.get(cellKey);
                        const status = record?.status;
                        const isSaving = busyWorkerDay === cellKey;
                        const isToday = dateStr === todayKey();

                        return (
                          <td
                            key={dateStr}
                            onClick={() => handleCellClick(w, dateStr)}
                            className={`text-center p-1 border-r border-slate-100 dark:border-slate-800 cursor-pointer select-none transition-all ${
                              isToday ? 'bg-indigo-50/20' : ''
                            } hover:bg-slate-100/80 dark:hover:bg-slate-800`}
                          >
                            <div
                              className={`w-9 h-9 mx-auto rounded-xl flex items-center justify-center font-black text-xs transition-transform active:scale-90 border ${
                                isSaving
                                  ? 'animate-pulse bg-slate-100 border-slate-300 text-slate-400'
                                  : status === 'present'
                                  ? 'bg-emerald-500 text-white border-emerald-600 shadow-2xs'
                                  : status === 'half_day'
                                  ? 'bg-amber-400 text-amber-950 border-amber-500'
                                  : status === 'absent'
                                  ? 'bg-rose-500 text-white border-rose-600'
                                  : status === 'overtime'
                                  ? 'bg-purple-600 text-white border-purple-700'
                                  : 'border-dashed border-slate-300 dark:border-slate-700 text-slate-300 dark:text-slate-600 hover:border-slate-400'
                              }`}
                            >
                              {isSaving ? (
                                '..'
                              ) : status === 'present' ? (
                                'P'
                              ) : status === 'half_day' ? (
                                'H'
                              ) : status === 'absent' ? (
                                'A'
                              ) : status === 'overtime' ? (
                                'OT'
                              ) : (
                                '-'
                              )}
                            </div>
                          </td>
                        );
                      })}

                      {/* Summary Metrics */}
                      <td className="py-2.5 px-2 text-center text-xs font-bold text-slate-700 dark:text-slate-300 border-r border-slate-100 dark:border-slate-800">
                        <span className="text-emerald-600">{stats.pCount}P</span>
                        {stats.hCount > 0 && <span className="text-amber-600 ml-1">{stats.hCount}H</span>}
                        {stats.otHoursTotal > 0 && <span className="text-purple-600 ml-1">{stats.otHoursTotal}h</span>}
                      </td>

                      <td className="py-2.5 px-2 text-right text-xs font-extrabold text-slate-900 dark:text-slate-100 border-r border-slate-100 dark:border-slate-800">
                        {formatINR(stats.grossWage)}
                      </td>

                      <td className="py-2.5 px-2 text-right text-xs font-bold text-rose-600 border-r border-slate-100 dark:border-slate-800">
                        {stats.advanceTaken > 0 ? `-${formatINR(stats.advanceTaken)}` : '₹0'}
                      </td>

                      <td className="py-2.5 px-2 text-right text-xs font-black text-emerald-600 dark:text-emerald-400 border-r border-slate-100 dark:border-slate-800">
                        {formatINR(stats.netPayout)}
                      </td>

                      {/* Payslip Action Button */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleOpenPayslip(w)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold rounded-lg bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 transition shadow-2xs"
                        >
                          <FileText size={12} />
                          <span>{lang === 'ta' ? 'ரசீது' : 'Payslip'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── 3. Overtime Hours Input Modal ── */}
      {otPrompt.isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl p-5 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-purple-600" />
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {lang === 'ta' ? 'கூடுதல் வேலை நேரம் (OT)' : 'Record Overtime (OT)'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOtPrompt({ isOpen: false, worker: null, date: '', hours: 2 })}
                className="text-slate-400 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>

            <div className="text-xs text-slate-500">
              {otPrompt.worker?.name} · {formatDay(otPrompt.date)}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 block mb-1">
                {lang === 'ta' ? 'கூடுதல் வேலை மணிநேரம்' : 'Overtime Hours Worked'}
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={otPrompt.hours}
                  onChange={e => setOtPrompt(prev => ({ ...prev, hours: Math.max(0.5, Number(e.target.value)) }))}
                  className="w-full text-base font-extrabold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-800 p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 focus:outline-none"
                />
                <span className="text-xs font-bold text-slate-400">hours</span>
              </div>
            </div>

            {/* Quick Hours Pills */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 6].map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => setOtPrompt(prev => ({ ...prev, hours: h }))}
                  className={`flex-1 py-1 text-xs font-bold rounded-lg border transition ${
                    otPrompt.hours === h
                      ? 'bg-purple-600 text-white border-purple-600'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200'
                  }`}
                >
                  {h}h
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOtPrompt({ isOpen: false, worker: null, date: '', hours: 2 })}
                className="flex-1 py-2 text-xs font-bold rounded-xl border border-slate-300 text-slate-600 hover:bg-slate-100"
              >
                {lang === 'ta' ? 'ரத்து' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={handleConfirmOT}
                className="flex-1 py-2 text-xs font-bold rounded-xl bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
              >
                {lang === 'ta' ? 'சேமி' : 'Save OT'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 4. Worker Wage Slip (Payslip Modal) ── */}
      {payslipModal.isOpen && payslipData && (
        <div className="fixed inset-0 z-50 overflow-hidden flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <FileText size={20} className="text-indigo-600" />
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-slate-100">
                    {t('worker_payslip')}
                  </h3>
                  <div className="text-[11px] text-slate-500">
                    {activeSite.name} · {payslipData.periodStr}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPayslipModal({ isOpen: false, worker: null, startDate: '', endDate: '' })}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Worker Details Card */}
            <div className="bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                  {payslipData.worker.name}
                </div>
                <div className="text-xs text-indigo-600 font-bold mt-0.5">
                  {roleLabel(payslipData.worker.category)}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  {payslipData.worker.phone || 'No mobile registered'}
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-bold uppercase text-slate-400">{t('daily_wage')}</div>
                <div className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                  {formatINR(payslipData.worker.dailyWage)}
                </div>
                <div className="text-[10px] text-slate-500">
                  OT: {formatINR(payslipData.hourlyRate)}/hr
                </div>
              </div>
            </div>

            {/* Days & Particulars Table */}
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                <span className="text-slate-600 dark:text-slate-300">{t('present_days')}</span>
                <span className="font-extrabold text-slate-900 dark:text-slate-100">
                  {payslipData.pCount} days = {formatINR(payslipData.pCount * payslipData.worker.dailyWage)}
                </span>
              </div>

              {payslipData.hCount > 0 && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-slate-600 dark:text-slate-300">{t('half_days')}</span>
                  <span className="font-extrabold text-slate-900 dark:text-slate-100">
                    {payslipData.hCount} days = {formatINR(payslipData.hCount * 0.5 * payslipData.worker.dailyWage)}
                  </span>
                </div>
              )}

              {payslipData.otHoursTotal > 0 && (
                <div className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-slate-800/40">
                  <span className="text-slate-600 dark:text-slate-300">{t('ot_hours')}</span>
                  <span className="font-extrabold text-purple-600">
                    {payslipData.otHoursTotal} hrs = {formatINR(payslipData.otHoursTotal * payslipData.hourlyRate)}
                  </span>
                </div>
              )}

              {/* Gross */}
              <div className="flex items-center justify-between p-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold">
                <span className="text-slate-700 dark:text-slate-200">{t('total_earned')}</span>
                <span className="text-sm font-black text-slate-900 dark:text-slate-100">
                  {formatINR(payslipData.grossWage)}
                </span>
              </div>

              {/* Advance Deductions */}
              <div className="flex items-center justify-between p-2 rounded-xl bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 font-bold">
                <span>{t('advances_recovered')}</span>
                <span>(-) {formatINR(payslipData.advanceTaken)}</span>
              </div>

              {/* Net Cash in Hand */}
              <div className="flex items-center justify-between p-3.5 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 text-white shadow-md">
                <div>
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-100">
                    {t('cash_in_hand')}
                  </div>
                  <div className="text-xs text-emerald-200">Disbursed in full cash</div>
                </div>
                <div className="text-xl font-black">{formatINR(payslipData.netPayout)}</div>
              </div>
            </div>

            {/* Actions: PDF, WhatsApp, Copy */}
            <div className="pt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={handlePrintPayslipPdf}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition"
              >
                <Download size={14} />
                <span>{t('print_pdf')}</span>
              </button>

              <button
                type="button"
                onClick={handleSendWhatsAppSlip}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition"
              >
                <Share2 size={14} />
                <span>{t('send_whatsapp')}</span>
              </button>

              <button
                type="button"
                onClick={handleCopySlipText}
                className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-bold text-xs transition border border-slate-200"
              >
                {copiedPayslip ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                <span>{copiedPayslip ? 'Copied!' : 'Copy Text'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
