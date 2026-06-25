/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
#ifndef __LIMNI_ENUMS_MQH__
#define __LIMNI_ENUMS_MQH__

enum StrategyProfile
{
  PROFILE_CUSTOM = 0,
  PROFILE_EIGHTCAP = 1,
  PROFILE_5ERS = 2,
  PROFILE_AUTO = 3
};

enum RiskProfile
{
  RISK_HIGH = 0,
  RISK_LOW = 1,
  RISK_GOD = 2,
  RISK_NORMAL = 3
};

enum SizingToleranceMode
{
  SIZING_STRICT_UNDER_TARGET = 0,
  SIZING_NEAREST_STEP_BOUNDED_OVERSHOOT = 1
};

enum EAState
{
  STATE_IDLE = 0,
  STATE_READY = 1,
  STATE_ACTIVE = 2,
  STATE_PAUSED = 3,
  STATE_CLOSED = 4
};

#endif // __LIMNI_ENUMS_MQH__
