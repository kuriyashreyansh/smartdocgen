import json
from pathlib import Path
from app.database import Base, engine, SessionLocal
from app.models import Club, DocType

HERE = Path(__file__).parent

def run():
    Base.metadata.create_all(engine)
    db = SessionLocal()

    officials = json.loads((HERE / "officials.json").read_text(encoding="utf-8"))
    club = db.query(Club).first()
    if not club:
        club = Club(name="ACM NIT Surat", full_name="ACM Student Chapter, SVNIT Surat", ref_prefix="ACM",
                    signatory_name="", signatory_designation="")
        db.add(club)
    club.officials = officials                       # refreshed from officials.json on every seed
    club.signatory_name = officials.get("head_name", "")
    club.signatory_designation = "Student Head"

    items = json.loads((HERE / "doc_types.json").read_text(encoding="utf-8"))
    for item in items:
        existing = db.query(DocType).filter_by(type_id=item["type_id"]).first()
        if existing:
            for k, v in item.items():
                setattr(existing, k, v)
        else:
            db.add(DocType(**item))

    db.commit()
    db.close()
    print("Seeded.")

if __name__ == "__main__":
    run()
