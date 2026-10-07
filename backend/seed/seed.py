import json
from pathlib import Path
from app.database import Base, engine, SessionLocal
from app.models import Club, DocType

def run():
    Base.metadata.create_all(engine)
    db = SessionLocal()

    if not db.query(Club).first():
        db.add(Club(
            name="ACM NIT Surat",
            full_name="ACM Student Chapter, SVNIT Surat",
            ref_prefix="ACM",
            signatory_name="Nidhi Arora",          # change to the real signatory
            signatory_designation="Community Head",   # change as needed
        ))

    items = json.loads((Path(__file__).parent / "doc_types.json").read_text(encoding="utf-8"))
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