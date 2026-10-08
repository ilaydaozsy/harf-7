from sqlalchemy import Column, Integer, String, Boolean
from app.database.database import Base


class Word(Base):
    __tablename__ = "words"

    id = Column(Integer, primary_key=True, index=True)
    word = Column(String(20), unique=True, nullable=False)
    length = Column(Integer, nullable=False)
    category = Column(String(50), nullable=True)
    difficulty = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True)