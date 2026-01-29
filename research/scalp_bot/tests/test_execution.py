import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - optional dependency for tests
    pd = None

from research.scalp_bot.config import ExecutionConfig, RiskConfig
from research.scalp_bot.execution import simulate_trade


class TestExecutionOrdering(unittest.TestCase):
    def test_sl_before_tp(self):
        if pd is None:
            self.skipTest("pandas not installed")
        tz = ZoneInfo("America/Toronto")
        times = [
            datetime(2025, 1, 2, 3, 0, tzinfo=tz),
            datetime(2025, 1, 2, 3, 5, tzinfo=tz),
            datetime(2025, 1, 2, 3, 10, tzinfo=tz),
        ]
        df = pd.DataFrame(
            {
                "time": times,
                "open": [1.1000, 1.1000, 1.1000],
                "high": [1.1005, 1.1020, 1.1000],
                "low": [1.0995, 1.0980, 1.1000],
                "close": [1.1000, 1.1000, 1.1000],
            }
        )
        risk_cfg = RiskConfig(tp_pips=10.0)
        exec_cfg = ExecutionConfig(conservative_sl_tp=True)
        trade = simulate_trade(
            df=df,
            entry_idx=0,
            pair="EURUSD",
            direction="long",
            entry_price=1.1000,
            stop_price=1.0990,
            tp_price=1.1010,
            risk_cfg=risk_cfg,
            exec_cfg=exec_cfg,
            pip_size=0.0001,
            spread_pips=0.0,
            ref_high=1.1010,
            ref_low=1.0990,
            entry_time=times[0],
            time_stop=None,
        )
        self.assertIsNotNone(trade)
        self.assertEqual(trade.reason, "sl")


if __name__ == "__main__":
    unittest.main()
