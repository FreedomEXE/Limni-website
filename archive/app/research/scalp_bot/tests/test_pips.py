import unittest

from research.scalp_bot.utils import pip_size


class TestPipSize(unittest.TestCase):
    def test_pip_size_jpy(self):
        self.assertEqual(pip_size("USDJPY"), 0.01)

    def test_pip_size_non_jpy(self):
        self.assertEqual(pip_size("EURUSD"), 0.0001)


if __name__ == "__main__":
    unittest.main()