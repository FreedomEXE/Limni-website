/*-----------------------------------------------
  Session and event guards for LimniPortfolioEA
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_SESSION_CALENDAR_MQH__
#define __LIMNI_PORTFOLIO_SESSION_CALENDAR_MQH__

#include "..\\Core\\Types.mqh"

struct LP_CalendarDecision
{
   bool trade_allowed;
   bool week_boundary_blocked;
   bool news_blocked;
   string reason;
   datetime server_time;
   datetime est_time;
};

datetime LP_ToEstBoundaryTime(const datetime server_time, const LP_Config &config)
{
   return (datetime)((long)server_time + (long)MathRound(config.broker_to_est_offset_hours * 3600.0));
}

bool LP_WeekBoundaryBlocked(const datetime server_time, const LP_Config &config)
{
   if(!config.use_week_boundary_guard)
      return false;

   MqlDateTime parts;
   TimeToStruct(LP_ToEstBoundaryTime(server_time, config), parts);
   int minute = parts.hour * 60 + parts.min;
   int sunday_start = config.sunday_open_hour_est * 60;
   int friday_end = config.friday_close_hour_est * 60;
   int friday_start = friday_end - config.boundary_block_minutes;

   if(parts.day_of_week == 0 && minute >= sunday_start && minute < sunday_start + config.boundary_block_minutes)
      return true;

   if(parts.day_of_week == 5 && minute >= friday_start && minute < friday_end)
      return true;

   return false;
}

bool LP_NewsGuardRequiresSource(const LP_Config &config)
{
   return config.news_guard_mode == LP_NEWS_GUARD_REQUIRED_FOR_LIVE ||
      config.news_guard_mode == LP_NEWS_GUARD_MANUAL_FILE;
}

bool LP_NewsSourceConfigured(const LP_Config &config)
{
   if(config.news_guard_mode == LP_NEWS_GUARD_DISABLED)
      return true;
   return StringLen(config.news_calendar_file) > 0;
}

bool LP_NewsBlockedNow(const datetime server_time, const LP_Config &config, string &reason)
{
   reason = "";
   if(config.news_guard_mode == LP_NEWS_GUARD_DISABLED)
      return false;

   if(!LP_NewsSourceConfigured(config))
   {
      reason = "news_source_missing";
      return config.news_guard_mode == LP_NEWS_GUARD_REQUIRED_FOR_LIVE;
   }

   reason = "news_guard_configured";
   return false;
}

void LP_EvaluateCalendar(const datetime server_time, const LP_Config &config, LP_CalendarDecision &decision)
{
   decision.server_time = server_time;
   decision.est_time = LP_ToEstBoundaryTime(server_time, config);
   decision.week_boundary_blocked = LP_WeekBoundaryBlocked(server_time, config);

   string news_reason = "";
   decision.news_blocked = LP_NewsBlockedNow(server_time, config, news_reason);
   decision.trade_allowed = !decision.week_boundary_blocked && !decision.news_blocked;

   if(decision.week_boundary_blocked)
      decision.reason = "week_boundary";
   else if(decision.news_blocked)
      decision.reason = news_reason == "" ? "news_guard" : news_reason;
   else
      decision.reason = "allowed";
}

string LP_WeekBoundaryDescription()
{
   return "No opens, closes, or grid adds during Sunday 17:00-17:59 EST and Friday 16:00-16:59 EST.";
}

#endif // __LIMNI_PORTFOLIO_SESSION_CALENDAR_MQH__
