"""
WorkDesk Python Analytics & KPI Engine
Performs statistical analysis, stand-up participation metrics, and executive digests directly on SQLite.
"""

import sys
import os
import sqlite3
import json
from datetime import datetime

def run_analytics(db_path):
    if not os.path.exists(db_path):
        print(json.dumps({"error": f"Database file not found at {db_path}"}))
        return

    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    try:
        # Total tasks by status
        cursor.execute("SELECT status, count(*) as count FROM Task GROUP BY status")
        status_counts = {row["status"]: row["count"] for row in cursor.fetchall()}

        # Total tasks by priority
        cursor.execute("SELECT priority, count(*) as count FROM Task GROUP BY priority")
        priority_counts = {row["priority"]: row["count"] for row in cursor.fetchall()}

        # Urgency breakdown
        cursor.execute("SELECT urgency, count(*) as count FROM Task GROUP BY urgency")
        urgency_counts = {row["urgency"]: row["count"] for row in cursor.fetchall()}

        # Standups count
        cursor.execute("SELECT count(*) as total, sum(hasBlockers) as blockers FROM Standup")
        standup_row = cursor.fetchone()
        standup_stats = {
            "total_submitted": standup_row["total"] or 0,
            "with_blockers": standup_row["blockers"] or 0
        }

        # User counts
        cursor.execute("SELECT count(*) as total_users FROM User WHERE isActive = 1")
        user_row = cursor.fetchone()
        total_active_users = user_row["total_users"] or 0

        # Calculate Completion and Risk metrics
        total_tasks = sum(status_counts.values())
        done_tasks = status_counts.get("Done", 0)
        completion_pct = round((done_tasks / total_tasks * 100), 1) if total_tasks > 0 else 0

        report = {
            "timestamp": datetime.now().isoformat(),
            "executive_summary": {
                "total_tasks": total_tasks,
                "completion_percentage": completion_pct,
                "active_employees": total_active_users,
                "standup_submissions": standup_stats["total_submitted"],
                "active_blockers": standup_stats["with_blockers"]
            },
            "status_distribution": status_counts,
            "priority_distribution": priority_counts,
            "urgency_distribution": urgency_counts,
            "system_health": "EXCELLENT" if standup_stats["with_blockers"] == 0 else "ATTENTION_REQUIRED"
        }

        print(json.dumps(report, indent=2))

    except Exception as e:
        print(json.dumps({"error": str(e)}))
    finally:
        conn.close()

if __name__ == "__main__":
    db = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "../apps/api/prisma/dev.db")
    run_analytics(db)
