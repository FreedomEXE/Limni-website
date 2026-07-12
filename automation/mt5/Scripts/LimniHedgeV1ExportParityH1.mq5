//+------------------------------------------------------------------+
//|                                 LimniHedgeV1ExportParityH1.mq5  |
//|        Exports broker H1 bars plus David buffer state for Gate 92|
//+------------------------------------------------------------------+
#property strict
#property script_show_inputs

enum MATypes
{
   SMA=0,
   EMA=1,
   SMMA=2,
   LWMA=3,
};

enum MAPrices
{
   Close_Price=0,
   Open_Price=1,
   Hight_Price=2,
   Low_Price=3,
   Median_Price=4,
   Typical_Price=5,
   Weighted_Price=6,
};

input string SymbolsCsv="AUDCAD,AUDJPY,AUDCHF,USDCAD,USDJPY,USDCHF";
input datetime FromTime=D'2014.07.02 00:00';
input datetime ToTime=D'2026.07.03 23:59';
input string IndicatorName="David_MA_Color_V1f_Updated";
input int MAPeriod=100;
input MATypes MAType=LWMA;
input MAPrices MAPrice=Close_Price;
input bool UseRSI_Filter=true;
input int RSIPeriod=100;
input int RSIOverBought=70;
input int RSIOverSold=30;
input string OutputFolder="LimniHedge_V1_Parity";
input bool ExportRsi6040Profile=true;
input string Rsi6040OutputFolder="LimniHedge_V1_Parity_RSI60_40";

void AddUniqueSymbol(string &list[], const string value)
{
   if(value=="")
      return;
   for(int i=0; i<ArraySize(list); i++)
   {
      if(list[i]==value)
         return;
   }
   int size=ArraySize(list);
   ArrayResize(list,size+1);
   list[size]=value;
}

string Trim(const string value)
{
   string out=value;
   StringTrimLeft(out);
   StringTrimRight(out);
   return out;
}

string NormalizeSymbolKey(const string value)
{
   string out="";
   string upper=value;
   StringToUpper(upper);
   int len=StringLen(upper);
   for(int i=0; i<len; i++)
   {
      string ch=StringSubstr(upper,i,1);
      int code=StringGetCharacter(ch,0);
      if((code>=48 && code<=57) || (code>=65 && code<=90))
         out+=ch;
   }
   return out;
}

string ApiSymbolFromInput(const string value)
{
   string key=NormalizeSymbolKey(value);
   if(StringLen(key)>=6)
      return StringSubstr(key,0,6);
   return key;
}

void ParseSymbols(const string csv, string &symbols[])
{
   ArrayResize(symbols,0);
   int start=0;
   while(start<StringLen(csv))
   {
      int comma=StringFind(csv,",",start);
      if(comma<0)
         comma=StringLen(csv);
      string token=Trim(StringSubstr(csv,start,comma-start));
      AddUniqueSymbol(symbols,token);
      start=comma+1;
   }
}

bool ResolveSymbolByNormalizedKey(const string targetKey, string &resolved)
{
   if(targetKey=="")
      return false;

   int bestScore=2147483647;
   string bestSymbol="";

   for(int pass=0; pass<2; pass++)
   {
      bool selectedOnly=(pass==0);
      int total=SymbolsTotal(selectedOnly);
      for(int i=0; i<total; i++)
      {
         string sym=SymbolName(i,selectedOnly);
         string symKey=NormalizeSymbolKey(sym);
         if(symKey=="")
            continue;
         if(StringFind(symKey,targetKey)<0 && StringFind(targetKey,symKey)<0)
            continue;
         if(!SymbolSelect(sym,true))
            continue;
         int score=MathAbs(StringLen(symKey)-StringLen(targetKey));
         if(score<bestScore)
         {
            bestScore=score;
            bestSymbol=sym;
         }
      }
   }

   if(bestSymbol!="")
   {
      resolved=bestSymbol;
      return true;
   }
   return false;
}

bool ResolveSymbol(const string inputSymbol, string &apiSymbol, string &brokerSymbol)
{
   apiSymbol=ApiSymbolFromInput(inputSymbol);
   brokerSymbol="";
   if(apiSymbol=="")
      return false;

   if(SymbolSelect(inputSymbol,true))
   {
      brokerSymbol=inputSymbol;
      return true;
   }

   return ResolveSymbolByNormalizedKey(apiSymbol,brokerSymbol);
}

int CreateDavidHandle(
   const string brokerSymbol,
   const int maPeriod,
   const MATypes maType,
   const MAPrices maPrice,
   const bool useRsiFilter,
   const int rsiPeriod,
   const int rsiOverBought,
   const int rsiOverSold
)
{
   ResetLastError();
   return iCustom(
      brokerSymbol,
      PERIOD_H1,
      IndicatorName,
      "<------LIMNI HEDGE MA------>",
      "",
      "MA Settings",
      maPeriod,
      maType,
      maPrice,
      "",
      "RSI Filter Settings",
      useRsiFilter,
      rsiPeriod,
      rsiOverBought,
      rsiOverSold,
      "",
      "MA Dots Settings:",
      3,
      clrSkyBlue,
      clrYellow
   );
}

bool BufferHasValue(const double value)
{
   return MathIsValidNumber(value) && value!=EMPTY_VALUE;
}

string TimeStamp(const datetime value)
{
   return TimeToString(value,TIME_DATE|TIME_SECONDS);
}

string Dbl(const double value, const int digits)
{
   return DoubleToString(value,digits);
}

bool ExportSymbol(
   const string apiSymbol,
   const string brokerSymbol,
   const string outputFolder,
   const int maPeriod,
   const MATypes maType,
   const MAPrices maPrice,
   const bool useRsiFilter,
   const int rsiPeriod,
   const int rsiOverBought,
   const int rsiOverSold
)
{
   if(!SymbolSelect(brokerSymbol,true))
   {
      Print("Gate92 export: SymbolSelect failed for ",brokerSymbol);
      return false;
   }

   MqlRates rates[];
   ArraySetAsSeries(rates,false);
   int copied=CopyRates(brokerSymbol,PERIOD_H1,FromTime,ToTime,rates);
   if(copied<=0)
   {
      Print("Gate92 export: no H1 rates for ",brokerSymbol," error=",GetLastError());
      return false;
   }

   int davidHandle=CreateDavidHandle(brokerSymbol,maPeriod,maType,maPrice,useRsiFilter,rsiPeriod,rsiOverBought,rsiOverSold);
   if(davidHandle==INVALID_HANDLE)
   {
      Print("Gate92 export: David handle failed for ",brokerSymbol," error=",GetLastError());
      return false;
   }

   double down[];
   double up[];
   ArraySetAsSeries(down,false);
   ArraySetAsSeries(up,false);
   int copiedDown=CopyBuffer(davidHandle,0,FromTime,ToTime,down);
   int copiedUp=CopyBuffer(davidHandle,1,FromTime,ToTime,up);
   IndicatorRelease(davidHandle);

   int usable=MathMin(copied,MathMin(copiedDown,copiedUp));
   if(usable<=0)
   {
      Print("Gate92 export: David buffers unavailable for ",brokerSymbol," down=",copiedDown," up=",copiedUp);
      return false;
   }

   FolderCreate(outputFolder);
   string fileName=outputFolder+"\\"+apiSymbol+"_H1_LimniHedgeV1Parity.csv";
   int handle=FileOpen(fileName,FILE_WRITE|FILE_CSV|FILE_ANSI,',');
   if(handle==INVALID_HANDLE)
   {
      Print("Gate92 export: FileOpen failed for ",fileName," error=",GetLastError());
      return false;
   }

   FileWrite(
      handle,
      "symbol",
      "broker_symbol",
      "bar_time",
      "open",
      "high",
      "low",
      "close",
      "tick_volume",
      "spread",
      "david_down_buffer",
      "david_up_buffer",
      "david_state"
   );

   int digits=(int)SymbolInfoInteger(brokerSymbol,SYMBOL_DIGITS);
   for(int i=0; i<usable; i++)
   {
      string state="UNKNOWN";
      if(BufferHasValue(down[i]))
         state="DOWN";
      else if(BufferHasValue(up[i]))
         state="UP";

      FileWrite(
         handle,
         apiSymbol,
         brokerSymbol,
         TimeStamp(rates[i].time),
         Dbl(rates[i].open,digits),
         Dbl(rates[i].high,digits),
         Dbl(rates[i].low,digits),
         Dbl(rates[i].close,digits),
         IntegerToString((int)rates[i].tick_volume),
         IntegerToString(rates[i].spread),
         BufferHasValue(down[i]) ? Dbl(down[i],digits+2) : "",
         BufferHasValue(up[i]) ? Dbl(up[i],digits+2) : "",
         state
      );
   }

   FileClose(handle);
   Print("Gate92 export complete: ",apiSymbol," broker=",brokerSymbol," rows=",usable," file=",fileName);
   return true;
}

int ExportProfile(
   const string profileName,
   string &symbols[],
   const string outputFolder,
   const int maPeriod,
   const MATypes maType,
   const MAPrices maPrice,
   const bool useRsiFilter,
   const int rsiPeriod,
   const int rsiOverBought,
   const int rsiOverSold
)
{
   int exported=0;
   for(int i=0; i<ArraySize(symbols); i++)
   {
      string apiSymbol="";
      string brokerSymbol="";
      if(!ResolveSymbol(symbols[i],apiSymbol,brokerSymbol))
      {
         Print("Gate92 export: resolve failed for ",symbols[i]," profile=",profileName);
         continue;
      }
      if(ExportSymbol(apiSymbol,brokerSymbol,outputFolder,maPeriod,maType,maPrice,useRsiFilter,rsiPeriod,rsiOverBought,rsiOverSold))
         exported++;
   }

   Print("Gate92 export profile finished. profile=",profileName," symbols_exported=",exported," output_folder=",outputFolder);
   return exported;
}

void OnStart()
{
   string symbols[];
   ParseSymbols(SymbolsCsv,symbols);
   if(ArraySize(symbols)==0)
   {
      Print("Gate92 export: no symbols requested.");
      return;
   }

   int exported=ExportProfile("default",symbols,OutputFolder,MAPeriod,MAType,MAPrice,UseRSI_Filter,RSIPeriod,RSIOverBought,RSIOverSold);
   int exported6040=0;
   if(ExportRsi6040Profile)
      exported6040=ExportProfile("rsi60_40",symbols,Rsi6040OutputFolder,MAPeriod,MAType,MAPrice,UseRSI_Filter,RSIPeriod,60,40);

   Print("Gate92 export finished. default_symbols_exported=",exported," rsi60_40_symbols_exported=",exported6040);
}
