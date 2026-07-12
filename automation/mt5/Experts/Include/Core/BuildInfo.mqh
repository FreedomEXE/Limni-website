/*-----------------------------------------------
  Limni Portfolio EA modular portfolio shell
  Gate 108A institutional integration
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_BUILD_INFO_MQH__
#define __LIMNI_PORTFOLIO_BUILD_INFO_MQH__

const string LP_EA_NAME = "Limni Portfolio EA";
const string LP_EA_VERSION = "1.039";
const string LP_BUILD_GATE = "Gate109Fx28CycleStartInvariantRepair";
const string LP_BUILD_SCOPE = "phase-fx28-cycle-start-invariant-decomposition-v1";
const string LP_EA_SOURCE_BUNDLE_ALGORITHM = "sha256-canonical-local-include-closure-v1";
const string LP_EA_SOURCE_BUNDLE_ID = "sha256:86bb1b6a48f3d55ea340fcb3e790431f97882f19582e6383c6fa486c22ac98e8";
const string LP_GATE108_CONTROLLED_PROFILE_ID = "gate108-core-institutional-v1";
const bool LP_GATE108_CONTROLLED_BUILD = true;
const long LP_MAGIC_BASE = 930000000000000;
const int LP_MAGIC_MAJOR_VERSION = 1;

string LP_EA_SourceBundleShort()
{
   const string prefix = "sha256:";
   if(StringFind(LP_EA_SOURCE_BUNDLE_ID, prefix) != 0)
      return LP_EA_SOURCE_BUNDLE_ID;
   return StringSubstr(LP_EA_SOURCE_BUNDLE_ID, StringLen(prefix), 12);
}

string LP_EA_DisplayName()
{
   return LP_EA_NAME + " v" + LP_EA_VERSION +
      " [" + LP_EA_SourceBundleShort() + "]";
}

#endif // __LIMNI_PORTFOLIO_BUILD_INFO_MQH__
