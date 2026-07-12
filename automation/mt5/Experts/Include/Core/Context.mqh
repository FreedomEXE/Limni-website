/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
#ifndef __LIMNI_CONTEXT_MQH__
#define __LIMNI_CONTEXT_MQH__

string GV_WEEK_START = "WeekStart";
string GV_STATE = "State";
string GV_BASELINE = "Baseline";
string GV_LOCKED = "Locked";
string GV_TRAIL = "TrailActive";
string GV_CLOSE = "CloseRequested";
string GV_WEEK_PEAK = "WeekPeak";
string GV_MAX_DD = "MaxDD";
string GV_LAST_PUSH = "LastPush";
string GV_CYCLE_BASELINE = "CycleBaseline";
string GV_CYCLE_PEAK = "CyclePeak";
string GV_ADAPTIVE_PEAK_AVG = "AdaptivePeakAvg";
string GV_LAST_WEEK_PEAK = "LastWeekPeak";
string GV_ADAPTIVE_PEAK_SUM = "AdaptivePeakSum";
string GV_ADAPTIVE_PEAK_COUNT = "AdaptivePeakCount";
string GV_POST_FRIDAY_HOLD = "PostFridayHold";
string GV_LAST_DAILY_CLOSE = "LastDailyClose";
string GV_LAST_DAILY_REOPEN = "LastDailyReopen";
string GV_DAILY_FLAT_ACTIVE = "DailyFlatActive";

string SanitizeScopePart(const string value)
{
  string out = "";
  int len = StringLen(value);
  for(int i = 0; i < len; i++)
  {
    ushort ch = (ushort)StringGetCharacter(value, i);
    bool digit = (ch >= '0' && ch <= '9');
    bool upper = (ch >= 'A' && ch <= 'Z');
    bool lower = (ch >= 'a' && ch <= 'z');
    if(digit || upper || lower)
      out += ShortToString(ch);
    else
      out += "_";
  }
  if(out == "")
    out = "default";
  return out;
}

string BuildScopePrefix()
{
  long login = AccountInfoInteger(ACCOUNT_LOGIN);
  string server = SanitizeScopePart(AccountInfoString(ACCOUNT_SERVER));
  string company = SanitizeScopePart(AccountInfoString(ACCOUNT_COMPANY));
  return StringFormat("Limni_%I64d_%s_%s_", login, server, company);
}

string ScopeKey(const string suffix)
{
  return g_scopePrefix + suffix;
}

string ScopeCacheFileName(const string baseName)
{
  return ScopeKey(baseName);
}

#endif // __LIMNI_CONTEXT_MQH__
