"""Dev fixtures: a noisy one-circuit play on Aer, shaped like a Qollab IonQ run."""
import json, os, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, root)
from qiskit_aer import AerSimulator
from qiskit_aer.noise import NoiseModel, depolarizing_error, ReadoutError
from nosig import web, play
p2, pm = 0.0106, 0.0061
nm = NoiseModel()
nm.add_all_qubit_quantum_error(depolarizing_error(p2 * 16 / 15, 2), ["cx", "cz"])
nm.add_all_qubit_readout_error(ReadoutError([[1 - pm, pm], [pm, 1 - pm]]))
sim = AerSimulator(noise_model=nm, method="matrix_product_state", seed_simulator=4)
orig = play.profile
def fp(b):
    p = orig(b)
    p.update(name="ionq_simulator", family="ionq", model="forte-enterprise-1", label="IonQ Forte Enterprise 1 noise model",
             one_circuit=True, cap=29, hardware=False)
    return p
play.profile = fp
os.chdir(root)
json.dump(json.loads(web.boot(sim)), open("dev/boot.json", "w"))
json.dump(json.loads(web.play(sim, shots=1000)), open("dev/run.json", "w"))
print("ok")
