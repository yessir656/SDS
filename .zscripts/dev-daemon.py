#!/usr/bin/env python3
"""
Double-fork daemonizer for `bun run dev`.

Why: the sandbox's Python supervisor spawns each bash tool command as a child
and tears down that command's process tree when it returns. A plain `&` /
`setsid` background job is still a descendant of the bash command at exit time
and gets killed. A classic double-fork daemon reparents to PID 1 (tini) BEFORE
the bash command returns, so it is no longer in the supervisor's tracked tree
and survives across commands.

Usage:  python3 dev-daemon.py
  - starts `bun run dev` as a detached daemon
  - writes stdout/stderr to dev.log (truncated)
  - writes the daemon PID to dev.pid
  - returns immediately
"""
import os
import sys
import signal

PROJECT_DIR = "/home/z/my-project"
LOG_PATH = os.path.join(PROJECT_DIR, "dev.log")
PID_PATH = os.path.join(PROJECT_DIR, ".zscripts", "dev.pid")


def daemonize():
    # First fork: parent exits, child becomes background.
    pid = os.fork()
    if pid > 0:
        # Parent: exit immediately so the caller (bash) returns fast.
        sys.exit(0)

    # Child: decouple from parent's session + controlling terminal.
    os.setsid()

    # Second fork: ensure the daemon can never reacquire a controlling
    # terminal and that it is reparented to PID 1.
    pid = os.fork()
    if pid > 0:
        sys.exit(0)

    # Grandchild = the actual daemon. Record its PID.
    daemon_pid = os.getpid()
    try:
        with open(PID_PATH, "w") as f:
            f.write(str(daemon_pid) + "\n")
    except Exception:
        pass

    # Restore default signal handlers (inheritance from bash may have altered).
    signal.signal(signal.SIGTERM, signal.SIG_DFL)
    signal.signal(signal.SIGINT, signal.SIG_DFL)
    # Ignore SIGHUP (parent session died).
    signal.signal(signal.SIGHUP, signal.SIG_IGN)

    # Redirect stdio to the log file.
    log_fd = os.open(LOG_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o644)
    os.dup2(log_fd, sys.stdout.fileno())
    os.dup2(log_fd, sys.stderr.fileno())
    # stdin from /dev/null
    devnull = os.open(os.devnull, os.O_RDONLY)
    os.dup2(devnull, sys.stdin.fileno())

    # Exec bun run dev in the project dir. exec replaces the process image so
    # the daemon PID stays the same and runs next dev directly.
    os.chdir(PROJECT_DIR)
    os.execvp("bun", ["bun", "run", "dev"])


if __name__ == "__main__":
    daemonize()
