import dateparser
from datetime import datetime

# Words that show the date depends on today's date (needs user confirmation)
RELATIVE_WORDS = ["today", "tomorrow", "yesterday", "next", "last",
                  "this", "kal", "aaj", "parso"]


def normalize_date(raw):
    """Convert raw date text into a real ISO date.

    Returns: (iso_date, is_relative)
      "12 Feb"      -> ("2027-02-12", False)
      "next Friday" -> ("2026-10-16", True)
      unparseable   -> (None, False)
    """
    if not raw:
        return None, False

    text = str(raw).strip()

    # Relative dates are guesses, so the UI should ask the user to confirm them
    is_relative = any(w in text.lower() for w in RELATIVE_WORDS)

    parsed = dateparser.parse(
        text,
        settings={
            "PREFER_DATES_FROM": "future",  # "12 Feb" means the upcoming 12 Feb
            "DATE_ORDER": "DMY",            # Indian style: day/month/year
        },
    )
    if parsed is None:
        return None, False
    return parsed.date().isoformat(), is_relative


def pretty_date(iso_date):
    """Format '2027-02-12' as '12 February 2027' for use inside the letter."""
    if not iso_date:
        return None
    return datetime.strptime(iso_date, "%Y-%m-%d").strftime("%d %B %Y").lstrip("0")