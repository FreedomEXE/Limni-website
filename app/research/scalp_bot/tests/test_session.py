import unittest
from datetime import date, time
from zoneinfo import ZoneInfo

from research.scalp_bot.utils import session_bounds


class TestSessionBounds(unittest.TestCase):
    def test_wraps_midnight(self):
        try:
            ZoneInfo("America/Toronto")
        except Exception:
            self.skipTest("tzdata not installed")
        start, end = session_bounds(time(19, 0), time(0, 0), date(2025, 1, 1), "America/Toronto")
        self.assertLess(start, end)
        self.assertEqual(start.tzinfo, ZoneInfo("America/Toronto"))
        self.assertEqual(end.date(), date(2025, 1, 2))


if __name__ == "__main__":
    unittest.main()
