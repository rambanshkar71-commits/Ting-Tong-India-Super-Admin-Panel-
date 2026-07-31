import React, { useState } from 'react';
import { Restaurant, Order } from '../../types';
import { exportToPDF, exportToExcel, printReport } from '../../services/exportService';
import {
  BarChart3,
  FileSpreadsheet,
  FileText,
  Printer,
  TrendingUp,
  Percent,
  Ban,
  Bike,
  Calendar,
  Download,
} from 'lucide-react';

interface ReportsExportTabProps {
  restaurant: Restaurant;
  orders: Order[];
}

export default function ReportsExportTab({ restaurant, orders }: ReportsExportTabProps) {
  const [dateRange, setDateRange] = useState<'all' | 'today' | 'week' | 'month'>('all');

  // Filter orders by restaurant and selected date range
  const restOrders = orders.filter((o) => {
    if (o.restaurantId !== restaurant.id) return false;
    if (dateRange === 'all') return true;

    const orderDate = new Date(o.createdAt);
    const now = new Date();
    if (dateRange === 'today') {
      return orderDate.toDateString() === now.toDateString();
    }
    if (dateRange === 'week') {
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      return orderDate >= weekAgo;
    }
    if (dateRange === 'month') {
      const monthAgo = new Date(now.getTime() - 30 * 86400000);
      return orderDate >= monthAgo;
    }
    return true;
  });

  const completedOrders = restOrders.filter((o) => o.status === 'delivered');
  const cancelledOrders = restOrders.filter((o) => o.status === 'cancelled');
  const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
  const totalCommission = totalRevenue * ((restaurant.commissionPercentage || 15) / 100);
  const netEarnings = totalRevenue - totalCommission;

  // 1. Export Performance & Revenue Report
  const handleExportRevenueReport = (format: 'excel' | 'pdf' | 'print') => {
    const rows = completedOrders.map((o) => [
      o.id.substring(0, 10),
      o.customerName || 'Customer',
      `Rs.${o.totalAmount || 0}`,
      `Rs.${((o.totalAmount || 0) * (restaurant.commissionPercentage || 15)) / 100}`,
      `Rs.${(o.totalAmount || 0) * (1 - (restaurant.commissionPercentage || 15) / 100)}`,
      new Date(o.createdAt).toLocaleDateString(),
    ]);

    if (format === 'excel') {
      const excelData = completedOrders.map((o) => ({
        'Order ID': o.id,
        'Customer Name': o.customerName || 'N/A',
        'Gross Amount (₹)': o.totalAmount || 0,
        'Platform Commission (₹)': ((o.totalAmount || 0) * (restaurant.commissionPercentage || 15)) / 100,
        'Merchant Net Earnings (₹)': (o.totalAmount || 0) * (1 - (restaurant.commissionPercentage || 15) / 100),
        'Order Status': o.status,
        'Date': new Date(o.createdAt).toLocaleString(),
      }));
      exportToExcel(excelData, `${restaurant.name}_RevenueReport`, 'Revenue Report');
    } else if (format === 'pdf') {
      const headers = ['Order ID', 'Customer', 'Gross Sales', 'Commission', 'Net Merchant', 'Date'];
      exportToPDF(`Revenue & Commission Report - ${restaurant.name}`, headers, rows, `${restaurant.name}_RevenueReport`);
    } else {
      const htmlRows = rows
        .map(
          (r) =>
            `<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td><td><strong>${r[4]}</strong></td><td>${r[5]}</td></tr>`
        )
        .join('');
      const html = `
        <h3>Total Sales: ₹${totalRevenue.toLocaleString()} | Total Commission: ₹${totalCommission.toLocaleString()} | Net Merchant Earnings: ₹${netEarnings.toLocaleString()}</h3>
        <table>
          <thead>
            <tr>
              <th>Order ID</th>
              <th>Customer</th>
              <th>Gross Sales</th>
              <th>Commission (${restaurant.commissionPercentage || 15}%)</th>
              <th>Net Merchant</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>${htmlRows}</tbody>
        </table>
      `;
      printReport(`Revenue Report - ${restaurant.name}`, html);
    }
  };

  // 2. Export Cancellation Analysis Report
  const handleExportCancellationReport = (format: 'excel' | 'pdf') => {
    const rows = cancelledOrders.map((o) => [
      o.id.substring(0, 10),
      o.customerName || 'Customer',
      `Rs.${o.totalAmount || 0}`,
      o.cancelledBy || 'System / Customer',
      o.cancelReason || 'Unspecified',
      new Date(o.createdAt).toLocaleDateString(),
    ]);

    if (format === 'excel') {
      const excelData = cancelledOrders.map((o) => ({
        'Order ID': o.id,
        'Customer Name': o.customerName || 'N/A',
        'Amount (₹)': o.totalAmount || 0,
        'Cancelled By': o.cancelledBy || 'System / Customer',
        'Cancellation Reason': o.cancelReason || 'Unspecified',
        'Date': new Date(o.createdAt).toLocaleString(),
      }));
      exportToExcel(excelData, `${restaurant.name}_CancellationReport`, 'Cancellations');
    } else {
      const headers = ['Order ID', 'Customer', 'Amount', 'Cancelled By', 'Reason', 'Date'];
      exportToPDF(`Cancellation Analysis - ${restaurant.name}`, headers, rows, `${restaurant.name}_CancellationReport`);
    }
  };

  return (
    <div className="space-y-6 text-slate-100 animate-fade-in">
      {/* Top Controls & Filter */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-md">
        <div>
          <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-orange-400" /> Enterprise Financial & Operational Reporting System
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Download or print official PDF and Excel reports for accounting, tax auditing, and operational analysis.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-slate-400" />
          <span className="text-xs font-mono text-slate-400">Date Range:</span>
          {(['all', 'today', 'week', 'month'] as const).map((rng) => (
            <button
              key={rng}
              onClick={() => setDateRange(rng)}
              className={`px-3 py-1 rounded-xl text-xs font-bold font-mono uppercase transition cursor-pointer border ${
                dateRange === rng
                  ? 'bg-orange-500/10 border-orange-500/50 text-orange-400'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {rng}
            </button>
          ))}
        </div>
      </div>

      {/* Report Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Report 1: Revenue & Commission Statement */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" /> Revenue & Commission Audit Report
            </h4>
            <span className="text-[10px] font-mono font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded">
              {completedOrders.length} Delivered Orders
            </span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Gross Orders Value:</span>
              <span className="text-slate-100 font-bold">₹{totalRevenue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Platform Commission ({restaurant.commissionPercentage || 15}%):</span>
              <span className="text-rose-400 font-bold">-₹{totalCommission.toLocaleString()}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-800 text-sm">
              <span className="text-slate-300 font-bold">Net Merchant Earnings:</span>
              <span className="text-emerald-400 font-bold">₹{netEarnings.toLocaleString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => handleExportRevenueReport('excel')}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Download Excel
            </button>
            <button
              onClick={() => handleExportRevenueReport('pdf')}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" /> Download PDF
            </button>
            <button
              onClick={() => handleExportRevenueReport('print')}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-bold transition border border-slate-700 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-cyan-400" />
            </button>
          </div>
        </div>

        {/* Report 2: Cancellation & Rejection Analysis */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-md">
          <div className="flex items-center justify-between">
            <h4 className="font-bold text-sm text-slate-100 flex items-center gap-2">
              <Ban className="w-4 h-4 text-rose-400" /> Order Cancellation & Rejection Report
            </h4>
            <span className="text-[10px] font-mono font-bold text-rose-400 bg-rose-500/10 border border-rose-500/20 px-2 py-0.5 rounded">
              {cancelledOrders.length} Cancelled
            </span>
          </div>

          <div className="bg-slate-950 p-4 rounded-xl border border-slate-850 space-y-2 font-mono text-xs">
            <div className="flex justify-between">
              <span className="text-slate-400">Total Cancelled Value:</span>
              <span className="text-rose-400 font-bold">
                ₹{cancelledOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0).toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Cancellation Rate:</span>
              <span className="text-slate-100 font-bold">
                {restOrders.length ? Math.round((cancelledOrders.length / restOrders.length) * 100) : 0}%
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => handleExportCancellationReport('excel')}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Download Excel
            </button>
            <button
              onClick={() => handleExportCancellationReport('pdf')}
              className="flex-1 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2 rounded-xl text-xs font-bold transition border border-slate-700 flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5 text-rose-400" /> Download PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
