
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Package, Plus, Calculator } from 'lucide-react';
import { format, startOfMonth } from 'date-fns';

interface StockManagementProps {
  stationId: string;
}

interface MonthlyStock {
  id: string;
  product_type: string;
  month_year: string;
  opening_stock: number;
  actual_closing_stock: number | null;
  excess: number | null;
}

const StockManagement = ({ stationId }: StockManagementProps) => {
  const [monthlyStocks, setMonthlyStocks] = useState<MonthlyStock[]>([]);
  const [selectedMonth, setSelectedMonth] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStock, setSelectedStock] = useState<MonthlyStock | null>(null);
  const [actualClosingStock, setActualClosingStock] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const productTypes = ['PMS', 'AGO', 'LPG'];

  useEffect(() => {
    loadMonthlyStocks();
  }, [stationId, selectedMonth]);

  const loadMonthlyStocks = async () => {
    try {
      const { data, error } = await supabase
        .from('monthly_stock')
        .select('*')
        .eq('station_id', stationId)
        .eq('month_year', selectedMonth)
        .order('product_type');

      if (error) throw error;
      setMonthlyStocks(data || []);
    } catch (error) {
      console.error('Error loading monthly stocks:', error);
    }
  };

  const initializeMonthlyStock = async (productType: string) => {
    try {
      // Get the last month's closing stock as opening stock
      const lastMonth = new Date(selectedMonth);
      lastMonth.setMonth(lastMonth.getMonth() - 1);
      const lastMonthFormatted = format(startOfMonth(lastMonth), 'yyyy-MM-dd');

      const { data: lastMonthData } = await supabase
        .from('monthly_stock')
        .select('actual_closing_stock')
        .eq('station_id', stationId)
        .eq('product_type', productType)
        .eq('month_year', lastMonthFormatted)
        .single();

      const openingStock = lastMonthData?.actual_closing_stock || 0;

      const { error } = await supabase
        .from('monthly_stock')
        .insert({
          station_id: stationId,
          product_type: productType,
          month_year: selectedMonth,
          opening_stock: openingStock
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: `${productType} stock initialized for ${format(new Date(selectedMonth), 'MMMM yyyy')}`,
      });

      loadMonthlyStocks();
    } catch (error) {
      console.error('Error initializing stock:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to initialize stock",
      });
    }
  };

  const updateActualClosingStock = async () => {
    if (!selectedStock) return;

    setLoading(true);
    try {
      const actualClosing = parseFloat(actualClosingStock);
      const excess = selectedStock.opening_stock - actualClosing;

      const { error } = await supabase
        .from('monthly_stock')
        .update({
          actual_closing_stock: actualClosing,
          excess: excess
        })
        .eq('id', selectedStock.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Actual closing stock updated successfully",
      });

      setIsDialogOpen(false);
      setSelectedStock(null);
      setActualClosingStock('');
      loadMonthlyStocks();
    } catch (error) {
      console.error('Error updating stock:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to update stock",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateEstimatedStock = async (productType: string) => {
    try {
      // Get total sales for the month
      const monthStart = selectedMonth;
      const nextMonth = new Date(selectedMonth);
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      const monthEnd = format(nextMonth, 'yyyy-MM-dd');

      const { data: salesData, error } = await supabase
        .from('fuel_records')
        .select('sales_volume')
        .eq('station_code', stationId)
        .eq('product_type', productType)
        .gte('record_date', monthStart)
        .lt('record_date', monthEnd);

      if (error) throw error;

      const totalSalesVolume = salesData?.reduce((sum, record) => sum + (record.sales_volume || 0), 0) || 0;
      
      const stock = monthlyStocks.find(s => s.product_type === productType);
      const openingStock = stock?.opening_stock || 0;
      const estimatedStock = openingStock - totalSalesVolume;

      return { totalSalesVolume, estimatedStock };
    } catch (error) {
      console.error('Error calculating estimated stock:', error);
      return { totalSalesVolume: 0, estimatedStock: 0 };
    }
  };

  return (
    <div className="space-y-6">
      {/* Month Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Stock Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Label htmlFor="stock-month">Select Month:</Label>
            <Input
              id="stock-month"
              type="month"
              value={format(new Date(selectedMonth), 'yyyy-MM')}
              onChange={(e) => setSelectedMonth(format(new Date(e.target.value), 'yyyy-MM-dd'))}
              className="w-auto"
            />
          </div>
        </CardContent>
      </Card>

      {/* Stock Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {productTypes.map(productType => {
          const stock = monthlyStocks.find(s => s.product_type === productType);
          
          return (
            <Card key={productType}>
              <CardHeader>
                <CardTitle className="text-lg">{productType} Stock</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {stock ? (
                  <>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-gray-600">Opening Stock:</span>
                        <span className="font-medium">{stock.opening_stock.toLocaleString()}L</span>
                      </div>
                      
                      {stock.actual_closing_stock !== null ? (
                        <>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Actual Closing:</span>
                            <span className="font-medium">{stock.actual_closing_stock.toLocaleString()}L</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-sm text-gray-600">Excess/Shortage:</span>
                            <span className={`font-medium ${(stock.excess || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {(stock.excess || 0).toLocaleString()}L
                            </span>
                          </div>
                        </>
                      ) : (
                        <Button
                          onClick={() => {
                            setSelectedStock(stock);
                            setIsDialogOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="w-full"
                        >
                          <Calculator className="mr-2 h-4 w-4" />
                          Set Actual Closing
                        </Button>
                      )}
                    </div>
                  </>
                ) : (
                  <Button
                    onClick={() => initializeMonthlyStock(productType)}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Initialize Stock
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Update Actual Closing Stock Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Set Actual Closing Stock - {selectedStock?.product_type}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="actual-closing">Actual Closing Stock (Litres)</Label>
              <Input
                id="actual-closing"
                type="number"
                step="0.01"
                value={actualClosingStock}
                onChange={(e) => setActualClosingStock(e.target.value)}
                placeholder="Enter actual closing stock"
              />
            </div>
            
            {selectedStock && actualClosingStock && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm">
                  <span className="font-medium">Opening Stock:</span> {selectedStock.opening_stock.toLocaleString()}L
                </p>
                <p className="text-sm">
                  <span className="font-medium">Actual Closing:</span> {parseFloat(actualClosingStock).toLocaleString()}L
                </p>
                <p className="text-sm">
                  <span className="font-medium">Excess/Shortage:</span> 
                  <span className={`ml-1 ${(selectedStock.opening_stock - parseFloat(actualClosingStock)) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(selectedStock.opening_stock - parseFloat(actualClosingStock)).toLocaleString()}L
                  </span>
                </p>
              </div>
            )}
            
            <div className="flex gap-2">
              <Button onClick={updateActualClosingStock} disabled={loading || !actualClosingStock}>
                {loading ? 'Updating...' : 'Update Stock'}
              </Button>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StockManagement;
