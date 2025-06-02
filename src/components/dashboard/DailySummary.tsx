
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Fuel } from 'lucide-react';
import { format } from 'date-fns';

interface DailySummaryProps {
  stationId: string;
}

interface SalesData {
  product_type: string;
  total_sales: number;
  total_volume: number;
}

interface ExpenseData {
  total_expenses: number;
}

const DailySummary = ({ stationId }: DailySummaryProps) => {
  const [salesData, setSalesData] = useState<SalesData[]>([]);
  const [expenseData, setExpenseData] = useState<ExpenseData[]>([]);
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummaryData();
  }, [stationId, selectedDate]);

  const loadSummaryData = async () => {
    setLoading(true);
    try {
      // Load sales data
      const { data: salesResult, error: salesError } = await supabase
        .from('fuel_records')
        .select('product_type, total_sales, sales_volume')
        .eq('station_code', stationId)
        .eq('record_date', selectedDate);

      if (salesError) throw salesError;

      // Aggregate sales by product type
      const aggregatedSales = salesResult?.reduce((acc: any[], record) => {
        const existing = acc.find(item => item.product_type === record.product_type);
        if (existing) {
          existing.total_sales += record.total_sales || 0;
          existing.total_volume += record.sales_volume || 0;
        } else {
          acc.push({
            product_type: record.product_type,
            total_sales: record.total_sales || 0,
            total_volume: record.sales_volume || 0
          });
        }
        return acc;
      }, []) || [];

      setSalesData(aggregatedSales);

      // Load expense data
      const { data: expenseResult, error: expenseError } = await supabase
        .from('expenses')
        .select('amount')
        .eq('station_id', stationId)
        .eq('expense_date', selectedDate);

      if (expenseError) throw expenseError;

      const totalExpenses = expenseResult?.reduce((sum, expense) => sum + (expense.amount || 0), 0) || 0;
      setExpenseData([{ total_expenses: totalExpenses }]);
    } catch (error) {
      console.error('Error loading summary data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalSales = salesData.reduce((sum, item) => sum + item.total_sales, 0);
  const totalExpenses = expenseData[0]?.total_expenses || 0;
  const netSales = totalSales - totalExpenses;

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

  const pieData = salesData.map((item, index) => ({
    name: item.product_type,
    value: item.total_sales,
    color: COLORS[index % COLORS.length]
  }));

  if (loading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-1/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <label htmlFor="summary-date" className="text-sm font-medium">
              Select Date:
            </label>
            <input
              id="summary-date"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <TrendingUp className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Sales</p>
                <p className="text-2xl font-bold text-gray-900">₦{totalSales.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-red-100 rounded-lg">
                <TrendingDown className="h-6 w-6 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900">₦{totalExpenses.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <DollarSign className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Net Sales</p>
                <p className={`text-2xl font-bold ${netSales >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₦{netSales.toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <Fuel className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Volume</p>
                <p className="text-2xl font-bold text-gray-900">
                  {salesData.reduce((sum, item) => sum + item.total_volume, 0).toLocaleString()}L
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Sales by Product</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={salesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="product_type" />
                <YAxis />
                <Tooltip formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Sales']} />
                <Bar dataKey="total_sales" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Sales Distribution</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => [`₦${Number(value).toLocaleString()}`, 'Sales']} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default DailySummary;
