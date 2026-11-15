"""Roda todas as coletas. Se uma fonte falhar, as outras seguem e o arquivo antigo daquela fonte é mantido."""
import sys, traceback, datajud, transparencia, ouvidoria
falhas = 0
for nome, mod in [('DataJud', datajud), ('Transparência AM', transparencia), ('Ouvidoria CGU', ouvidoria)]:
    print(f'=== {nome}')
    try: mod.main()
    except Exception:
        falhas += 1; traceback.print_exc(); print(f'!!! {nome} falhou — mantidos os dados anteriores')
print(f'Concluído com {falhas} falha(s).')
sys.exit(0)
