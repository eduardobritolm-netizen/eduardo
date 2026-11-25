"""Roda todas as coletas. Se uma fonte falhar, as outras seguem e o arquivo antigo daquela fonte é mantido."""
import sys, traceback, falabr_api, datajud, transparencia, ouvidoria, ouvidoria_export, ouvidoria_diario, pncp, precedentes, sefaz_exec, precos, pca, contratos_sefaz, contratos_sgc, convenios_sefaz, estagiarios
falhas = 0
for nome, mod in [('DataJud', datajud), ('Transparência AM', transparencia), ('Fala.BR API', falabr_api), ('Ouvidoria CGU', ouvidoria), ('Ouvidoria (export Fala.BR)', ouvidoria_export), ('Ouvidoria diário (PGE)', ouvidoria_diario), ('PNCP', pncp), ('PCA (PNCP)', pca), ('Contratos SGC (coleta)', contratos_sefaz), ('Contratos SGC (processa)', contratos_sgc), ('Convênios sisconv', convenios_sefaz), ('Precedentes LAI', precedentes), ('Despesas SEFAZ', sefaz_exec), ('Estagiários e residentes', estagiarios), ('Preços de mercado', precos)]:
    print(f'=== {nome}')
    try: mod.main()
    except Exception:
        falhas += 1; traceback.print_exc(); print(f'!!! {nome} falhou — mantidos os dados anteriores')
import api
try: api.main()
except Exception: falhas += 1; traceback.print_exc()
print(f'Concluído com {falhas} falha(s).')
sys.exit(0)
