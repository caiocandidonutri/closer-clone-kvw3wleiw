/// <reference path="../pb_data/types.d.ts" />
// Populate agent_materials with all recipes and meal_plan_templates

migrate(
  (app) => {
    const matCol = app.findCollectionByNameOrId('agent_materials')

    // Helper to generate specific tags from title
    const extractTags = (title, type) => {
      const t = (title || '').toLowerCase()
      const tags = []

      const addTag = (tag) => {
        if (tags.indexOf(tag) === -1) {
          tags.push(tag)
        }
      }

      if (type === 'recipe') {
        addTag('receita')
        if (t.indexOf('ovo') !== -1) {
          addTag('ovos')
          addTag('preparo')
          addTag('proteína')
          addTag('café da manhã')
        }
        if (t.indexOf('whey') !== -1) {
          addTag('whey')
          addTag('proteína')
          addTag('suplemento')
          addTag('shake')
        }
        if (t.indexOf('carne') !== -1 || t.indexOf('peixe') !== -1) {
          addTag('carne')
          addTag('peixe')
          addTag('proteína')
          addTag('almoço')
          addTag('jantar')
        }
        if (t.indexOf('lanche') !== -1) {
          addTag('lanche')
          addTag('snack')
          addTag('prático')
        }
        if (t.indexOf('tempero') !== -1) {
          addTag('tempero')
          addTag('condimento')
          addTag('caseiro')
        }
        if (t.indexOf('suco') !== -1 || t.indexOf('detox') !== -1) {
          addTag('suco')
          addTag('detox')
          addTag('bebida')
          addTag('desintoxicação')
        }
        if (t.indexOf('shot') !== -1) {
          addTag('shot')
          addTag('concentrado')
          addTag('imunidade')
        }
        if (t.indexOf('geladeira') !== -1 || t.indexOf('organizar') !== -1) {
          addTag('geladeira')
          addTag('organização')
          addTag('armazenamento')
        }
      } else if (type === 'meal_plan') {
        addTag('plano alimentar')
        if (t.indexOf('emagrecimento') !== -1 || t.indexOf('perda de peso') !== -1) {
          addTag('emagrecimento')
          addTag('perda de peso')
          addTag('dieta')
        }
        if (t.indexOf('massa') !== -1 || t.indexOf('muscular') !== -1 || t.indexOf('hipertrofia') !== -1) {
          addTag('hipertrofia')
          addTag('massa muscular')
          addTag('ganho de peso')
          addTag('proteína')
        }
        if (t.indexOf('desinflama') !== -1 || t.indexOf('desinflamação') !== -1) {
          addTag('anti-inflamatório')
          addTag('desinflamação')
          addTag('detox')
        }
        if (t.indexOf('acelera') !== -1 || t.indexOf('aceleração') !== -1) {
          addTag('aceleração')
          addTag('metabolismo')
          addTag('queima de gordura')
        }
        if (t.indexOf('diverticulite') !== -1) {
          addTag('diverticulite')
          addTag('intestinal')
          addTag('fibras')
        }
        if (t.indexOf('cirurgic') !== -1 || t.indexOf('cirúrgic') !== -1 || t.indexOf('operat') !== -1) {
          addTag('pós-operatório')
          addTag('recuperação')
          addTag('cicatrização')
        }
        if (t.indexOf('simples') !== -1 || t.indexOf('pratico') !== -1 || t.indexOf('prático') !== -1) {
          addTag('simples')
          addTag('prático')
          addTag('dia a dia')
        }
        if (t.indexOf('diabet') !== -1 || t.indexOf('glicem') !== -1) {
          addTag('diabetes')
          addTag('glicemia')
          addTag('índice glicêmico')
        }
        if (
          t.indexOf('cristiano') !== -1 ||
          t.indexOf('pollyana') !== -1 ||
          t.indexOf('paola') !== -1 ||
          t.indexOf('simone') !== -1 ||
          t.indexOf('inara') !== -1 ||
          t.indexOf('vanessa') !== -1 ||
          t.indexOf('gisleine') !== -1 ||
          t.indexOf('claudia') !== -1 ||
          t.indexOf('sara') !== -1 ||
          t.indexOf('leticia') !== -1 ||
          t.indexOf('letícia') !== -1 ||
          t.indexOf('aquila') !== -1 ||
          t.indexOf('bruna') !== -1 ||
          t.indexOf('angelica') !== -1 ||
          t.indexOf('angélica') !== -1 ||
          t.indexOf('lais') !== -1 ||
          t.indexOf('marina') !== -1 ||
          t.indexOf('vania') !== -1 ||
          t.indexOf('vânia') !== -1 ||
          t.indexOf('dadiani') !== -1 ||
          t.indexOf('personalizado') !== -1
        ) {
          addTag('personalizado')
        }
      }

      return tags
    }

    // Clean test record if present
    try {
      app.db().newQuery("DELETE FROM agent_materials WHERE title = 'Test Material 0022'").execute()
    } catch (_) {}

    const recipesData = [
      {
        id: '7yx3oiaxizn6j5w',
        title: '_E- BOOK SHOTS Dr. Caio Candido',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('_E- BOOK SHOTS Dr. Caio Candido', 'recipe'),
        description: 'E-book de shots matinais e imunidade por Dr. Caio Cândido',
      },
      {
        id: 'a4jon3w8seiunxg',
        title: '_E-book Diferentes formas de preparar seus ovos Dr. Caio Candido',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('_E-book Diferentes formas de preparar seus ovos Dr. Caio Candido', 'recipe'),
        description: 'E-book com receitas e formas variadas de preparar ovos',
      },
      {
        id: '2dlbkezcrpb1iir',
        title: 'e-book Temperos caseiros Dr. Caio Candido',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('e-book Temperos caseiros Dr. Caio Candido', 'recipe'),
        description: 'E-book com opções de temperos caseiros naturais e saudáveis',
      },
      {
        id: '81neff3xvpppxga',
        title: 'sucos detox Dr. Caio Candido',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('sucos detox Dr. Caio Candido', 'recipe'),
        description: 'Receitas de sucos detox funcionais e desintoxicantes',
      },
      {
        id: 't5kp4h3thy6sim5',
        title: 'E-book - Receitas com whey protein - Dr. Caio Candido Nutricionista .pdf.pd_20260730_191950_0000',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('E-book - Receitas com whey protein - Dr. Caio Candido Nutricionista', 'recipe'),
        description: 'E-book com receitas proteicas práticas utilizando whey protein',
      },
      {
        id: 'bhyrywn2o0zf1d2',
        title: 'Como organizar sua geladeira - Dr. Caio Candido Nutricionista_20260730_202054_0000',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Como organizar sua geladeira - Dr. Caio Candido Nutricionista', 'recipe'),
        description: 'Guia prático de organização e conservação de alimentos na geladeira',
      },
      {
        id: 's5ksn0k9oytl23l',
        title: 'Receitas Carne e Peixe - Dr. Caio Candido Nutricionista _20260731_021431_0000',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Receitas Carne e Peixe - Dr. Caio Candido Nutricionista', 'recipe'),
        description: 'Receitas saudáveis com carnes e peixes para almoço e jantar',
      },
      {
        id: 'upvroxsy97uf0h5',
        title: 'E-book - Receitas com whey protein - Dr. Caio Candido Nutricionista .pdf.pd_20260730_191950_0000 (2)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('E-book - Receitas com whey protein - Dr. Caio Candido Nutricionista', 'recipe'),
        description: 'E-book com receitas utilizando whey protein por Dr. Caio Cândido',
      },
      {
        id: 'nvi0ys19j89nt5z',
        title: 'Como organizar sua geladeira - Dr. Caio Candido Nutricionista_20260730_202054_0000 (2)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Como organizar sua geladeira - Dr. Caio Candido Nutricionista', 'recipe'),
        description: 'Guia de organização da geladeira e preservação de nutrientes',
      },
      {
        id: '9kohutxm8w956tg',
        title: 'Receitas Carne e Peixe - Dr. Caio Candido Nutricionista _20260731_021431_0000 (2)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Receitas Carne e Peixe - Dr. Caio Candido Nutricionista', 'recipe'),
        description: 'Opções e receitas preparadas com carnes nobres e peixes',
      },
      {
        id: 'fmtd4ipqy8f3oya',
        title: 'Receitas de Lanches Dr. Caio Candido Nutricionista .pdf_20260729_002829_0000',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Receitas de Lanches Dr. Caio Candido Nutricionista', 'recipe'),
        description: 'Receitas práticas de lanches saudáveis e intermediários',
      },
    ]

    for (let i = 0; i < recipesData.length; i++) {
      const item = recipesData[i]
      let exists = false
      try {
        app.findFirstRecordByData('agent_materials', 'source_id', item.id)
        exists = true
      } catch (_) {}

      if (!exists) {
        const rec = new Record(matCol)
        rec.set('title', item.title)
        rec.set('type', 'recipe')
        rec.set('source_collection', 'recipes')
        rec.set('source_id', item.id)
        rec.set('tags', item.tags)
        rec.set('description', item.description)
        rec.set('content_text', '')
        rec.set('is_active', item.is_active)
        rec.set('owner', item.owner)
        app.save(rec)
      }
    }

    const plansData = [
      {
        id: 'd9ipzozmj0glzxq',
        title: 'Plano Alimentar de Cristiano Cassiolato (1) (2)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Cristiano Cassiolato', 'meal_plan'),
        description: 'Plano alimentar personalizado para Cristiano Cassiolato',
      },
      {
        id: '5mwd03y6tucheua',
        title: 'Plano Alimentar de Pollyana Aparecida Miranda de Paula (6)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Pollyana Aparecida Miranda de Paula', 'meal_plan'),
        description: 'Plano alimentar individualizado para Pollyana Aparecida',
      },
      {
        id: 'qs2tjkw58jlskvt',
        title: 'Plano Alimentar de Paola Aparecida Leite',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Paola Aparecida Leite', 'meal_plan'),
        description: 'Plano alimentar personalizado para Paola Aparecida',
      },
      {
        id: 'uzrvcofwc1v38fr',
        title: 'PLANO-AVANCADO-METODO-VITA',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('PLANO-AVANCADO-METODO-VITA emagrecimento', 'meal_plan'),
        description: 'Plano avançado Método Vita para alta performance e emagrecimento',
      },
      {
        id: '8s5ilrtmj45e8wk',
        title: 'PLANO-INTERMEDIARIO-METODO-VITA',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('PLANO-INTERMEDIARIO-METODO-VITA emagrecimento', 'meal_plan'),
        description: 'Plano intermediário Método Vita com diretrizes nutricionais balanceadas',
      },
      {
        id: '3v8a8yc9kniikrn',
        title: 'Plano-Alimentar-Ganho-de-Massa-Muscular-Cristiano-Cassilato (3)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Ganho-de-Massa-Muscular-Cristiano-Cassilato', 'meal_plan'),
        description: 'Plano alimentar focado em hipertrofia e ganho de massa muscular',
      },
      {
        id: 'snbjbtm1smnrtwk',
        title: 'Plano Alimentar de Simone Fernandes da Silva (1)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Simone Fernandes da Silva', 'meal_plan'),
        description: 'Plano alimentar personalizado para Simone Fernandes',
      },
      {
        id: 'm45ki1w9o05xuzr',
        title: 'PLANO-ALIMENTAR-2-ACELERACAO-Dias-8-a-15 (1)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('PLANO-ALIMENTAR-2-ACELERACAO-Dias-8-a-15', 'meal_plan'),
        description: 'Plano alimentar fase 2 de aceleração metabólica (dias 8 a 15)',
      },
      {
        id: 'r6mpsqecxaz47mq',
        title: 'dieta_inara',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('dieta_inara', 'meal_plan'),
        description: 'Plano de dieta personalizado para paciente Inara',
      },
      {
        id: 'dr36vft63s12geu',
        title: 'Plano_Alimentar_Vanessa_Oliveira',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano_Alimentar_Vanessa_Oliveira', 'meal_plan'),
        description: 'Plano alimentar individualizado para Vanessa Oliveira',
      },
      {
        id: 'dz1txh4lfp5rry4',
        title: 'Plano-Alimentar-Personalizado (1)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Personalizado', 'meal_plan'),
        description: 'Modelo de plano alimentar estruturado e personalizado',
      },
      {
        id: 'xdxrbjrigtatr16',
        title: 'PLANO-ALIMENTAR-1-DESINFLAMACAO-Dias-1-a-7 (1)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('PLANO-ALIMENTAR-1-DESINFLAMACAO-Dias-1-a-7', 'meal_plan'),
        description: 'Plano alimentar fase 1 de desinflamação intestinal e corporal (dias 1 a 7)',
      },
      {
        id: 'c4eowsu9o5201ky',
        title: 'PLANO-ALIMENTAR-2-ACELERACAO-Dias-8-a-15',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('PLANO-ALIMENTAR-2-ACELERACAO-Dias-8-a-15', 'meal_plan'),
        description: 'Protocolo nutricional de aceleração de resultados e queima de gordura',
      },
      {
        id: 'evue4z91yma0w9n',
        title: 'Plano Alimentar de Gisleine Gonçalves Santos',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Gisleine Gonçalves Santos', 'meal_plan'),
        description: 'Plano alimentar para acompanhamento nutricional de Gisleine Gonçalves',
      },
      {
        id: '98rj41alsgewqd9',
        title: 'Plano-Alimentar-Ajustado-Claudia-Rodrigues-Moraes',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Ajustado-Claudia-Rodrigues-Moraes', 'meal_plan'),
        description: 'Ajuste no planejamento alimentar para Claudia Rodrigues Moraes',
      },
      {
        id: 'uldvg0nb7fcvfxo',
        title: 'Plano-Alimentar-Ajustado-Sara-Lisboa-Marques',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Ajustado-Sara-Lisboa-Marques', 'meal_plan'),
        description: 'Planejamento alimentar individualizado ajustado para Sara Lisboa',
      },
      {
        id: '4tcyiofxpyqc4r1',
        title: 'Plano-Alimentar-Semanal (3)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Semanal simples e pratico', 'meal_plan'),
        description: 'Guia de organização alimentar semanal equilibrado',
      },
      {
        id: 'dza6mga09vykqv7',
        title: 'Plano-Alimentar-Semanal (2)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Semanal simples e pratico', 'meal_plan'),
        description: 'Cardápio semanal variado para refeições do cotidiano',
      },
      {
        id: '5uufv88e207js71',
        title: 'Plano-Alimentar-Semanal (1)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Semanal simples e pratico', 'meal_plan'),
        description: 'Plano semanal de refeições saudáveis e fáceis de preparar',
      },
      {
        id: 'vlhjahqydsk08o7',
        title: 'Plano-Alimentar-Ganho-de-Massa-Muscular-Cristiano-Cassilato (1) (1)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Ganho-de-Massa-Muscular-Cristiano-Cassilato', 'meal_plan'),
        description: 'Plano para ganho de massa muscular com alta ingestão de proteínas',
      },
      {
        id: '7gjx6dz6457i77e',
        title: 'plano_alimentar_diverticulite',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('plano_alimentar_diverticulite', 'meal_plan'),
        description: 'Protocolo alimentar específico para cuidado e manejo da diverticulite',
      },
      {
        id: 'nmf03ap30o0d6k6',
        title: 'Plano Alimentar de Letícia Araújo Veronise (5)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Letícia Araújo Veronise', 'meal_plan'),
        description: 'Plano alimentar individualizado para Letícia Araújo',
      },
      {
        id: 'oz3rwlr6d2vbozg',
        title: 'Plano Alimentar de Aquila Aparecida Barbosa Martins (4)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Aquila Aparecida Barbosa Martins', 'meal_plan'),
        description: 'Plano alimentar personalizado para Aquila Aparecida',
      },
      {
        id: '412wrzfxyktc0uc',
        title: 'Plano-Alimentar-Personalizado-Bruna-Maria',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Personalizado-Bruna-Maria', 'meal_plan'),
        description: 'Plano nutricional customizado para Bruna Maria',
      },
      {
        id: 'n2brofpyw66zhx0',
        title: 'Plano Alimentar de Angélica Savioli Teixeira de Avila',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Angélica Savioli Teixeira de Avila', 'meal_plan'),
        description: 'Acompanhamento nutricional individualizado para Angélica Savioli',
      },
      {
        id: 'qb7dsgp2w27rhnb',
        title: 'Plano-Alimentar-Simples-e-Pratico-Lais-Alecrim',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Simples-e-Pratico-Lais-Alecrim', 'meal_plan'),
        description: 'Plano alimentar simples e prático para a rotina de Laís Alecrim',
      },
      {
        id: '898zlvg9l33ija6',
        title: 'Plano-Alimentar-Pratico-Marina-Vieira',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Pratico-Marina-Vieira', 'meal_plan'),
        description: 'Cardápio prático e balanceado para Marina Vieira',
      },
      {
        id: 'fh4r55lp79takuq',
        title: 'Plano-Alimentar-Pratico-para-Leticia-Veronese',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Pratico-para-Leticia-Veronese', 'meal_plan'),
        description: 'Plano alimentar prático desenvolvido para Letícia Veronese',
      },
      {
        id: 'mihh6s8cftwzvng',
        title: 'Plano-Alimentar-Atualizado-para-Leticia-Araujo-Veronise (1)',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Atualizado-para-Leticia-Araujo-Veronise', 'meal_plan'),
        description: 'Atualização do planejamento alimentar para Letícia Araújo',
      },
      {
        id: '9vy8z207x8y8rg1',
        title: 'Plano-Alimentar-Completo-para-Emagrecimento',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Completo-para-Emagrecimento', 'meal_plan'),
        description: 'Plano completo estruturado para emagrecimento saudável e sustentável',
      },
      {
        id: 'cl169qbjs97gfmp',
        title: 'Plano-Alimentar-Pos-Cirurgico-para-Paciente-Vania',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Pos-Cirurgico-para-Paciente-Vania', 'meal_plan'),
        description: 'Dieta e plano alimentar pós-cirúrgico para recuperação da paciente Vânia',
      },
      {
        id: 'ouf5l1flnutdp41',
        title: 'Plano-Alimentar-Atualizado-para-Leticia-Araujo-Veronise',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano-Alimentar-Atualizado-para-Leticia-Araujo-Veronise', 'meal_plan'),
        description: 'Plano alimentar revisado e atualizado para Letícia Araújo',
      },
      {
        id: 'nc46lx95px294ty',
        title: 'Plano Alimentar de Dadiani Campos vilela',
        owner: '3zyy01r8a6a6kuw',
        is_active: true,
        tags: extractTags('Plano Alimentar de Dadiani Campos vilela', 'meal_plan'),
        description: 'Plano alimentar personalizado para Dadiani Campos Vilela',
      },
    ]

    for (let i = 0; i < plansData.length; i++) {
      const item = plansData[i]
      let exists = false
      try {
        app.findFirstRecordByData('agent_materials', 'source_id', item.id)
        exists = true
      } catch (_) {}

      if (!exists) {
        const rec = new Record(matCol)
        rec.set('title', item.title)
        rec.set('type', 'meal_plan')
        rec.set('source_collection', 'meal_plan_templates')
        rec.set('source_id', item.id)
        rec.set('tags', item.tags)
        rec.set('description', item.description)
        rec.set('topic', 'Planos Alimentares')
        rec.set('content_text', '')
        rec.set('is_active', item.is_active)
        rec.set('owner', item.owner)
        app.save(rec)
      }
    }
  },
  (app) => {
    try {
      app.db().newQuery("DELETE FROM agent_materials WHERE source_collection IN ('recipes', 'meal_plan_templates')").execute()
    } catch (_) {}
  }
)
