from datetime import datetime
from app import db

class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password_hash = db.Column(db.String(120), nullable=False)
    is_admin = db.Column(db.Boolean, default=False)
    votes = db.relationship('Vote', backref='voter', lazy=True)

    def __repr__(self):
        return f'<User {self.username}>'

class Election(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False)
    description = db.Column(db.Text, nullable=True)
    start_date = db.Column(db.DateTime, default=datetime.utcnow)
    end_date = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    candidates = db.relationship('Candidate', backref='election', lazy=True, cascade="all, delete-orphan")
    votes = db.relationship('Vote', backref='election', lazy=True, cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Election {self.title}>'

class Candidate(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    election_id = db.Column(db.Integer, db.ForeignKey('election.id'), nullable=False)
    votes_received = db.relationship('Vote', backref='candidate', lazy=True)

    def __repr__(self):
        return f'<Candidate {self.name}>'

class Vote(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    election_id = db.Column(db.Integer, db.ForeignKey('election.id'), nullable=False)
    candidate_id = db.Column(db.Integer, db.ForeignKey('candidate.id'), nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'election_id', name='_user_election_uc'),)

    def __repr__(self):
        return f'<Vote by User {self.user_id} for Candidate {self.candidate_id} in Election {self.election_id}>'
