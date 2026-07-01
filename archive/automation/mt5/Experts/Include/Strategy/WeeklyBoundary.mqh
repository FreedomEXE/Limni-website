/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
#ifndef __LIMNI_WEEKLY_BOUNDARY_MQH__
#define __LIMNI_WEEKLY_BOUNDARY_MQH__

int LimniNthSunday(int year, int mon, int nth)
{
  MqlDateTime dt;
  dt.year = year;
  dt.mon = mon;
  dt.day = 1;
  dt.hour = 0;
  dt.min = 0;
  dt.sec = 0;

  datetime first = StructToTime(dt);
  MqlDateTime firstStruct;
  TimeToStruct(first, firstStruct);
  int offset = (7 - firstStruct.day_of_week) % 7;
  return 1 + offset + (nth - 1) * 7;
}

bool LimniIsUsdDstUtc(datetime nowGmt)
{
  MqlDateTime dt;
  TimeToStruct(nowGmt, dt);
  int year = dt.year;

  MqlDateTime start;
  start.year = year;
  start.mon = 3;
  start.day = LimniNthSunday(year, 3, 2);
  start.hour = 7;
  start.min = 0;
  start.sec = 0;

  MqlDateTime end;
  end.year = year;
  end.mon = 11;
  end.day = LimniNthSunday(year, 11, 1);
  end.hour = 6;
  end.min = 0;
  end.sec = 0;

  datetime startUtc = StructToTime(start);
  datetime endUtc = StructToTime(end);
  return nowGmt >= startUtc && nowGmt < endUtc;
}

bool LimniIsUsdDstLocal(int year, int mon, int day, int hour)
{
  int startDay = LimniNthSunday(year, 3, 2);
  int endDay = LimniNthSunday(year, 11, 1);

  if(mon < 3 || mon > 11)
    return false;
  if(mon > 3 && mon < 11)
    return true;
  if(mon == 3)
  {
    if(day > startDay)
      return true;
    if(day < startDay)
      return false;
    return hour >= 2;
  }
  if(mon == 11)
  {
    if(day < endDay)
      return true;
    if(day > endDay)
      return false;
    return hour < 2;
  }
  return false;
}

datetime LimniGmtToNewYorkLocal(datetime valueGmt)
{
  if(valueGmt <= 0)
    return 0;
  int offset = LimniIsUsdDstUtc(valueGmt) ? -4 : -5;
  return valueGmt + offset * 3600;
}

datetime LimniNewYorkLocalToGmt(datetime valueEt)
{
  if(valueEt <= 0)
    return 0;

  MqlDateTime et;
  TimeToStruct(valueEt, et);
  int offset = LimniIsUsdDstLocal(et.year, et.mon, et.day, et.hour) ? -4 : -5;
  return valueEt - offset * 3600;
}

datetime LimniGetWeekStartGmt(datetime nowGmt)
{
  datetime etNow = LimniGmtToNewYorkLocal(nowGmt);
  if(etNow <= 0)
    return 0;

  MqlDateTime et;
  TimeToStruct(etNow, et);
  int daysSinceSunday = et.day_of_week;
  datetime sundayEt = etNow - daysSinceSunday * 86400;

  MqlDateTime sunday;
  TimeToStruct(sundayEt, sunday);
  sunday.hour = 20;
  sunday.min = 0;
  sunday.sec = 0;
  sundayEt = StructToTime(sunday);

  if(etNow < sundayEt)
    sundayEt -= 7 * 86400;

  return LimniNewYorkLocalToGmt(sundayEt);
}

datetime LimniWeekEtToGmt(datetime weekStartGmt, int dayOffset, int hourEt, int minuteEt)
{
  datetime weekStartEt = LimniGmtToNewYorkLocal(weekStartGmt);
  if(weekStartEt <= 0)
    return 0;

  MqlDateTime et;
  TimeToStruct(weekStartEt, et);
  et.hour = hourEt;
  et.min = minuteEt;
  et.sec = 0;

  datetime targetEt = StructToTime(et) + dayOffset * 86400;
  return LimniNewYorkLocalToGmt(targetEt);
}

bool LimniIsTradeWindowOpen(datetime nowGmt, datetime weekStartGmt)
{
  datetime executionOpenGmt = LimniWeekEtToGmt(weekStartGmt, 0, 20, 0);
  datetime executionCloseGmt = LimniWeekEtToGmt(weekStartGmt, 5, 11, 0);
  return nowGmt >= executionOpenGmt && nowGmt < executionCloseGmt;
}

bool LimniIsEntryWindowOpen(datetime nowGmt, datetime weekStartGmt)
{
  return LimniIsTradeWindowOpen(nowGmt, weekStartGmt);
}

bool LimniIsActionWindowOpen(datetime nowGmt, datetime weekStartGmt)
{
  return LimniIsTradeWindowOpen(nowGmt, weekStartGmt);
}

string LimniCompactWeekTag(datetime weekStartGmt)
{
  MqlDateTime dt;
  TimeToStruct(weekStartGmt, dt);
  return StringFormat("%02d%02d%02d%02d", dt.year % 100, dt.mon, dt.day, dt.hour);
}

#endif // __LIMNI_WEEKLY_BOUNDARY_MQH__
