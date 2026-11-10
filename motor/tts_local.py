"""Voz neural local (Kokoro, modelo aberto), sem serviço externo.
Uso: python tts_local.py <modelo.onnx> <vozes.bin> <voz> <velocidade> <saida.wav>  (texto pela entrada padrão)
Vozes em português do Brasil: pm_alex, pm_santa (masculinas), pf_dora (feminina).
"""
import sys
import soundfile as sf
from kokoro_onnx import Kokoro

modelo, vozes, voz, velocidade, saida = sys.argv[1:6]
texto = sys.stdin.read().strip()
k = Kokoro(modelo, vozes)
audio, sr = k.create(texto, voice=voz, speed=float(velocidade), lang="pt-br")
sf.write(saida, audio, sr)
