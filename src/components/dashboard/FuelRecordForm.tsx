
import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';

interface Pump {
  id: string;
  pump_number: number;
  product_type: string;
  tank_id: string;
}

interface ProductPrice {
  product_type: string;
  price_per_litre: number;
}

interface FuelRecordFormProps {
  stationId: string;
}

const FuelRecordForm = ({ stationId }: FuelRecordFormProps) => {
  const [pumps, setPumps] = useState<Pump[]>([]);
  const [prices, setPrices] = useState<ProductPrice[]>([]);
  const [selectedPump, setSelectedPump] = useState<string>('');
  const [recordDate, setRecordDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [openingStock, setOpeningStock] = useState('');
  const [meterOpening, setMeterOpening] = useState('');
  const [meterClosing, setMeterClosing] = useState('');
  const [closingStock, setClosingStock] = useState('');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPumps();
    loadPrices();
  }, [stationId]);

  const loadPumps = async () => {
    try {
      const { data, error } = await supabase
        .from('pumps')
        .select('*')
        .eq('station_id', stationId)
        .order('pump_number');

      if (error) throw error;
      setPumps(data || []);
    } catch (error) {
      console.error('Error loading pumps:', error);
    }
  };

  const loadPrices = async () => {
    try {
      const { data, error } = await supabase
        .from('product_prices')
        .select('product_type, price_per_litre')
        .order('effective_date', { ascending: false });

      if (error) throw error;
      
      // Get latest price for each product
      const latestPrices: ProductPrice[] = [];
      const seenProducts = new Set();
      
      data?.forEach(price => {
        if (!seenProducts.has(price.product_type)) {
          latestPrices.push(price);
          seenProducts.add(price.product_type);
        }
      });
      
      setPrices(latestPrices);
    } catch (error) {
      console.error('Error loading prices:', error);
    }
  };

  const calculateSalesVolume = () => {
    const opening = parseFloat(meterOpening) || 0;
    const closing = parseFloat(meterClosing) || 0;
    return Math.max(0, closing - opening);
  };

  const getProductPrice = (productType: string) => {
    const price = prices.find(p => p.product_type === productType);
    return price?.price_per_litre || 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPump) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please select a pump",
      });
      return;
    }

    setLoading(true);

    try {
      const pump = pumps.find(p => p.id === selectedPump);
      if (!pump) throw new Error('Pump not found');

      const salesVolume = calculateSalesVolume();
      const pricePerLitre = getProductPrice(pump.product_type);
      const totalSales = salesVolume * pricePerLitre;

      const { error } = await supabase
        .from('fuel_records')
        .insert({
          station_code: stationId,
          pump_id: selectedPump,
          product_type: pump.product_type,
          record_date: recordDate,
          opening_stock: parseFloat(openingStock) || 0,
          closing_stock: parseFloat(closingStock) || 0,
          meter_opening: parseFloat(meterOpening) || 0,
          meter_closing: parseFloat(meterClosing) || 0,
          sales_volume: salesVolume,
          price_per_litre: pricePerLitre,
          total_sales: totalSales,
          input_mode: 'manual'
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Fuel record saved successfully",
      });

      // Reset form
      setSelectedPump('');
      setOpeningStock('');
      setMeterOpening('');
      setMeterClosing('');
      setClosingStock('');
    } catch (error) {
      console.error('Error saving fuel record:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to save fuel record",
      });
    } finally {
      setLoading(false);
    }
  };

  const selectedPumpData = pumps.find(p => p.id === selectedPump);
  const salesVolume = calculateSalesVolume();
  const pricePerLitre = selectedPumpData ? getProductPrice(selectedPumpData.product_type) : 0;
  const totalSales = salesVolume * pricePerLitre;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Add Fuel Record
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="date">Record Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={recordDate}
                  onChange={(e) => setRecordDate(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="pump">Pump</Label>
                <Select value={selectedPump} onValueChange={setSelectedPump} required>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a pump" />
                  </SelectTrigger>
                  <SelectContent>
                    {pumps.map((pump) => (
                      <SelectItem key={pump.id} value={pump.id}>
                        Pump {pump.pump_number} - {pump.product_type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="opening-stock">Opening Stock (Litres)</Label>
                <Input
                  id="opening-stock"
                  type="number"
                  step="0.01"
                  value={openingStock}
                  onChange={(e) => setOpeningStock(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="closing-stock">Closing Stock (Litres)</Label>
                <Input
                  id="closing-stock"
                  type="number"
                  step="0.01"
                  value={closingStock}
                  onChange={(e) => setClosingStock(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meter-opening">Meter Opening</Label>
                <Input
                  id="meter-opening"
                  type="number"
                  step="0.01"
                  value={meterOpening}
                  onChange={(e) => setMeterOpening(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="meter-closing">Meter Closing</Label>
                <Input
                  id="meter-closing"
                  type="number"
                  step="0.01"
                  value={meterClosing}
                  onChange={(e) => setMeterClosing(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {selectedPumpData && (
              <div className="bg-blue-50 p-4 rounded-lg space-y-2">
                <h4 className="font-semibold text-blue-900">Calculations</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600">Sales Volume:</span>
                    <span className="ml-2 font-medium">{salesVolume.toFixed(2)} L</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Price per Litre:</span>
                    <span className="ml-2 font-medium">₦{pricePerLitre.toFixed(2)}</span>
                  </div>
                  <div className="col-span-2">
                    <span className="text-gray-600">Total Sales:</span>
                    <span className="ml-2 font-bold text-green-600">₦{totalSales.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Saving...' : 'Save Fuel Record'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default FuelRecordForm;
