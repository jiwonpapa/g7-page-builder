"""Bounded child-process execution; timeout/interrupt also terminates descendants."""
import os
import signal
import subprocess


def run(argv, *, timeout=900, check=False, input=None, capture_output=False, **kwargs):
    if timeout <= 0:
        raise ValueError('Process timeout must be positive')
    if input is not None:
        if kwargs.get('stdin') is not None:
            raise ValueError('stdin and input cannot both be supplied')
        kwargs['stdin'] = subprocess.PIPE
    if capture_output:
        if 'stdout' in kwargs or 'stderr' in kwargs:
            raise ValueError('capture_output conflicts with stdout/stderr')
        kwargs.update(stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    with subprocess.Popen(argv, start_new_session=True, **kwargs) as process:
        try:
            stdout, stderr = process.communicate(input, timeout=timeout)
        except (subprocess.TimeoutExpired, KeyboardInterrupt):
            # Kill the entire owned group, including children still holding pipes.
            try:
                os.killpg(process.pid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            try:
                process.communicate(timeout=2)
            except subprocess.TimeoutExpired:
                pass
            finally:
                try:
                    os.killpg(process.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                process.wait(timeout=5)
            raise
        result = subprocess.CompletedProcess(argv, process.returncode, stdout, stderr)
        if check:
            result.check_returncode()
        return result
