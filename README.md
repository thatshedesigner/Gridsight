# GridSight

GridSight turns Bengaluru's parking violation and traffic incident records into a weekly, explainable enforcement priority ranking, with an AI generated operational brief for every police station zone.

Live demo: [Here](https://gridsight-blr.vercel.app/)

## The problem

Traffic enforcement in Bengaluru is largely deployed on instinct and complaints, not data. The city already runs two systems that could answer where enforcement is needed most: a parking violation log from enforcement cameras, and the Astram incident system that tracks road closures and disruptions. These two systems had never been connected.

## What it does

GridSight fuses 298,450 parking violation records and 8,173 traffic incident records across all 54 Bengaluru police station jurisdictions, spanning a five month window from November 2023 to April 2024. A LightGBM model trained on weekly violation patterns predicts whether a station is likely to see a road closure incident the following week. That prediction, combined with current violation density and week over week trend, produces a transparent priority score for every station, ranked from most to least urgent.

Each station has its own detail page with real charts, a breakdown of violation and vehicle types, the most affected junctions where that data exists, and a plain language explanation of why the station scored the way it did. A Gemini powered briefing generates a short operational note per station on request, grounded only in that station's real numbers, with a concrete recommendation on where to patrol and what to prioritize.

## How it works

### Data pipeline

Both source datasets are cleaned and aggregated into a weekly panel at the police station level. Violation records are parsed for vehicle type, violation subtype, and timestamp. Incident records are parsed for event cause, road closure status, and duration. The two are joined on police station and week.

### Model

A LightGBM binary classifier predicts whether a station will have a road closure incident the week after the features were recorded. This is a forward looking label by design, matching how the prediction is actually meant to be used: this week's pattern informing next week's deployment. The train, validation, and test split is chronological, not random, since shuffling would leak future information into training. Test set ROC AUC is 0.6043 and PR AUC is 0.4348, both held out and never touched during training or tuning.

### Scoring

The final priority score for each station combines three percentile ranked components:

40 percent violation density, how much enforcement activity this station saw last week relative to all other stations.

40 percent predicted closure risk, the model's output.

20 percent trend, how fast violations are rising or falling at this station.

The weights and every component score are shown on the methodology page, not hidden behind a single number.

### AI briefing

A server side route calls the Gemini API with the station's real numbers and asks for a short, grounded operational note. The model is instructed to use only the data provided and to recommend a concrete action, not a general statement.

## Tech stack

Next.js, App Router, TypeScript, Tailwind CSS

Python (pandas, LightGBM, scikit-learn) for the offline data and model pipeline

react-leaflet with OpenStreetMap tiles for the map

Recharts for the charts

Google Gemini API (gemini-2.5-flash) for the briefing feature

Vercel for hosting

No paid services are used anywhere in this project.

## Project structure

```
gridsight/
  pipeline/
    scripts/
      clean_data.py
      build_features.py
      train_model.py
      build_artifacts.py
  data/
    raw/             (not committed, source CSVs)
    processed/        (not committed, intermediate pipeline output)
  src/
    app/
      page.tsx                 dashboard
      station/[name]/           station detail pages
      methodology/              methodology page
      api/briefing/             Gemini briefing route
    components/
    lib/
      data.ts                   typed data loaders
    data/
      station-rankings.json
      heatmap-grid.json
      station-detail.json
      model-metrics.json
```

## Methodology and limitations

The model measures correlation between parking violation patterns and closure incidents at the police station level, not a direct measurement of congestion or minutes of delay, which neither source dataset records. It is trained on Bengaluru data specifically and would need retraining for another city. Roughly half of all violation records are not tied to a specific junction, so the ranking runs at the police station level, with junction detail shown only where it genuinely exists in the data.
