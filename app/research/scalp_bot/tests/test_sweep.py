import unittest
from datetime import datetime
from zoneinfo import ZoneInfo

try:
    import pandas as pd
except ModuleNotFoundError:  # pragma: no cover - optional dependency for tests
    pd = None

from research.scalp_bot.config import EntryConfig, SessionsConfig
from research.scalp_bot.signals import detect_sweep_signal
from research.scalp_bot.utils import SessionRef


class TestSweepDetection(unittest.TestCase):
    def test_bearish_sweep_displacement(self):
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
                "open": [1.1000, 1.1015, 1.1010],
                "high": [1.1010, 1.1030, 1.1012],
                "low": [1.0990, 1.1005, 1.0980],
                "close": [1.1005, 1.1008, 1.0985],
            }
        )
        ref = SessionRef(ref_high=1.1015, ref_low=1.0950, start=times[0], end=times[-1])
        entry_cfg = EntryConfig(sweep_buffer_pips=1.0, displacement_min_body_pips=3.0, displacement_close_pct=0.3)
        signal = detect_sweep_signal(df, times[0], times[-1], ref, entry_cfg, 0.0001, "short")
        self.assertIsNotNone(signal)
        self.assertEqual(signal.direction, "short")


if __name__ == "__main__":
    unittest.main()
