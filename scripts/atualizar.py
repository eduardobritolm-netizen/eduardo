"""Roda todas as coletas. Se uma fonte falhar, as outras seguem e o arquivo antigo daquela fonte é mantido."""
import sys, traceback, falabr_api, datajud, transparencia, ouvidoria, pncp
falhas = 0
for nome, mod in [('DataJud', datajud), ('Transparência AM', transparencia), ('Fala.BR API', falabr_api), ('Ouvidoria CGU', ouvidoria), ('PNCP', pncp)]:
    print(f'=== {nome}')
    try: mod.main()
    except Exception:
        falhas += 1; traceback.print_exc(); print(f'!!! {nome} falhou — mantidos os dados anteriores')
import api
try: api.main()
except Exception: falhas += 1; traceback.print_exc()
print(f'Concluído com {falhas} falha(s).')
sys.exit(0)
