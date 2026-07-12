//+------------------------------------------------------------------+
//|                                      LimniHedgeV1TickTrace.mq5   |
//|       Gate 92 tester tick-surface export for repo parity replay  |
//+------------------------------------------------------------------+
#property strict
#property version "1.000"

input string OutputFolder="LimniHedge_V1_TickTrace";
input int FlushEveryRows=10000;

int g_file=INVALID_HANDLE;
long g_rows=0;
string g_fileName="";

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
   if(StringLen(out)>=6)
      return StringSubstr(out,0,6);
   return out;
}

string StampSeconds(const datetime value)
{
   return TimeToString(value,TIME_DATE|TIME_SECONDS);
}

string Dbl(const double value,const int digits)
{
   return DoubleToString(value,digits);
}

int OnInit()
{
   FolderCreate(OutputFolder,FILE_COMMON);
   string symbolKey=NormalizeSymbolKey(_Symbol);
   g_fileName=OutputFolder+"\\"+symbolKey+"_"+EnumToString(_Period)+"_TickTrace.csv";
   g_file=FileOpen(g_fileName,FILE_WRITE|FILE_CSV|FILE_ANSI|FILE_COMMON,',');
   if(g_file==INVALID_HANDLE)
   {
      Print("Gate92 tick trace FileOpen failed: ",g_fileName," error=",GetLastError());
      return INIT_FAILED;
   }

   FileWrite(
      g_file,
      "symbol",
      "broker_symbol",
      "period",
      "tick_time",
      "tick_time_msc",
      "bar_time",
      "bid",
      "ask",
      "last",
      "volume_real",
      "spread_points",
      "flags"
   );
   Print("Gate92 tick trace started: ",g_fileName);
   return INIT_SUCCEEDED;
}

void OnTick()
{
   if(g_file==INVALID_HANDLE)
      return;

   MqlTick tick;
   if(!SymbolInfoTick(_Symbol,tick))
      return;

   datetime barTime=iTime(_Symbol,_Period,0);
   int digits=(int)SymbolInfoInteger(_Symbol,SYMBOL_DIGITS);
   double point=SymbolInfoDouble(_Symbol,SYMBOL_POINT);
   int spreadPoints=0;
   if(point>0.0)
      spreadPoints=(int)MathRound((tick.ask-tick.bid)/point);

   FileWrite(
      g_file,
      NormalizeSymbolKey(_Symbol),
      _Symbol,
      EnumToString(_Period),
      StampSeconds(tick.time),
      (string)tick.time_msc,
      StampSeconds(barTime),
      Dbl(tick.bid,digits),
      Dbl(tick.ask,digits),
      Dbl(tick.last,digits),
      Dbl(tick.volume_real,2),
      IntegerToString(spreadPoints),
      IntegerToString((int)tick.flags)
   );

   g_rows++;
   if(FlushEveryRows>0 && (g_rows%FlushEveryRows)==0)
      FileFlush(g_file);
}

void OnDeinit(const int reason)
{
   if(g_file!=INVALID_HANDLE)
   {
      FileFlush(g_file);
      FileClose(g_file);
      g_file=INVALID_HANDLE;
   }
   Print("Gate92 tick trace finished: ",g_fileName," rows=",g_rows," reason=",reason);
}
//+------------------------------------------------------------------+
