import re
import math
from typing import Optional


class AnalyticsService:
    """
    Computes sentiment and readability analytics without external ML deps.
    Uses rule-based sentiment lexicon + Flesch-Kincaid / Gunning Fog readability.
    """

    # Simplified AFINN-style word valence lexicon
    SENTIMENT_LEXICON = {
        # Positive
        "good": 3, "great": 4, "excellent": 5, "amazing": 5, "wonderful": 4,
        "fantastic": 5, "outstanding": 5, "superior": 4, "perfect": 5, "best": 4,
        "love": 4, "loved": 4, "like": 2, "liked": 2, "enjoy": 3, "enjoyed": 3,
        "beneficial": 3, "effective": 3, "efficient": 3, "innovative": 4,
        "positive": 3, "success": 4, "successful": 4, "improve": 3, "improved": 3,
        "valuable": 3, "helpful": 3, "useful": 3, "reliable": 3, "strong": 3,
        "clear": 2, "simple": 2, "easy": 2, "fast": 2, "robust": 3,
        "recommend": 3, "recommended": 3, "impressive": 4, "promising": 3,
        "significant": 2, "advance": 3, "advanced": 3, "enhanced": 3,
        # Negative
        "bad": -3, "poor": -3, "terrible": -5, "awful": -5, "horrible": -5,
        "worst": -5, "hate": -4, "hated": -4, "dislike": -2, "fail": -3,
        "failed": -3, "failure": -4, "problem": -2, "issue": -2, "bug": -2,
        "error": -2, "broken": -3, "wrong": -2, "difficult": -2, "hard": -1,
        "slow": -2, "weak": -2, "limited": -2, "missing": -2, "lack": -2,
        "lacking": -2, "concern": -2, "concerning": -3, "risk": -2, "risky": -3,
        "dangerous": -4, "harmful": -4, "negative": -3, "decline": -3,
        "decreased": -2, "worse": -3, "deprecated": -2, "obsolete": -3,
        # Intensifiers
        "very": 0.5, "extremely": 0.8, "incredibly": 0.8, "quite": 0.3,
        "somewhat": 0.2, "slightly": 0.1, "not": -1.0, "never": -1.0, "no": -0.5,
    }

    NEGATIONS = {"not", "never", "no", "neither", "nor", "without", "barely", "hardly", "scarcely"}

    async def analyze_text(self, text: str) -> dict:
        sentences = self._split_sentences(text)
        words = self._tokenize(text)

        sentiment = self._compute_sentiment(words)
        readability = self._compute_readability(text, sentences, words)
        word_stats = self._word_statistics(words)
        sentence_sentiments = [self._compute_sentence_sentiment(s) for s in sentences[:50]]

        return {
            "sentiment": sentiment,
            "readability": readability,
            "word_stats": word_stats,
            "sentence_sentiments": sentence_sentiments,
        }

    def _split_sentences(self, text: str) -> list[str]:
        sentences = re.split(r'(?<=[.!?])\s+', text.strip())
        return [s.strip() for s in sentences if len(s.strip()) > 10]

    def _tokenize(self, text: str) -> list[str]:
        return re.findall(r"\b[a-z']+\b", text.lower())

    def _count_syllables(self, word: str) -> int:
        word = word.lower().rstrip("e")
        count = len(re.findall(r"[aeiou]+", word))
        return max(1, count)

    def _is_complex_word(self, word: str) -> bool:
        return self._count_syllables(word) >= 3

    def _compute_sentiment(self, words: list[str]) -> dict:
        score = 0.0
        total_weighted = 0
        intensifier = 1.0
        negation_window = 0

        for i, word in enumerate(words):
            if word in self.NEGATIONS:
                negation_window = 3
                continue

            negate = negation_window > 0
            negation_window = max(0, negation_window - 1)

            if word in self.SENTIMENT_LEXICON:
                val = self.SENTIMENT_LEXICON[word]
                if abs(val) <= 1:  # intensifier
                    intensifier = 1 + val
                    continue
                adjusted = val * intensifier
                if negate:
                    adjusted *= -0.8
                score += adjusted
                total_weighted += 1
                intensifier = 1.0

        if total_weighted == 0:
            normalized = 0.0
        else:
            raw_avg = score / max(total_weighted, 1)
            normalized = max(-1.0, min(1.0, raw_avg / 5.0))

        if normalized > 0.15:
            label = "Positive"
        elif normalized < -0.15:
            label = "Negative"
        else:
            label = "Neutral"

        # Subjectivity: ratio of opinion words
        opinion_count = sum(1 for w in words if w in self.SENTIMENT_LEXICON and abs(self.SENTIMENT_LEXICON[w]) > 1)
        subjectivity = min(1.0, opinion_count / max(len(words), 1) * 10)

        return {
            "score": round(normalized, 3),
            "label": label,
            "subjectivity": round(subjectivity, 3),
            "confidence": min(0.95, 0.4 + abs(normalized) * 0.6),
        }

    def _compute_sentence_sentiment(self, sentence: str) -> dict:
        words = self._tokenize(sentence)
        result = self._compute_sentiment(words)
        return {"text": sentence[:80] + ("..." if len(sentence) > 80 else ""), "score": result["score"], "label": result["label"]}

    def _compute_readability(self, text: str, sentences: list[str], words: list[str]) -> dict:
        num_sentences = max(len(sentences), 1)
        num_words = max(len(words), 1)
        num_syllables = sum(self._count_syllables(w) for w in words)
        complex_words = sum(1 for w in words if self._is_complex_word(w))

        # Flesch Reading Ease (0–100, higher = easier)
        avg_sentence_len = num_words / num_sentences
        avg_syllables_per_word = num_syllables / num_words
        flesch = 206.835 - (1.015 * avg_sentence_len) - (84.6 * avg_syllables_per_word)
        flesch = max(0.0, min(100.0, flesch))

        # Flesch-Kincaid Grade Level
        fk_grade = (0.39 * avg_sentence_len) + (11.8 * avg_syllables_per_word) - 15.59
        fk_grade = max(0.0, min(20.0, fk_grade))

        # Gunning Fog Index
        fog = 0.4 * (avg_sentence_len + 100 * complex_words / num_words)

        # Map Flesch to label
        if flesch >= 80:
            level = "Very Easy"
        elif flesch >= 65:
            level = "Easy"
        elif flesch >= 50:
            level = "Standard"
        elif flesch >= 35:
            level = "Difficult"
        else:
            level = "Very Difficult"

        return {
            "flesch_reading_ease": round(flesch, 1),
            "flesch_kincaid_grade": round(fk_grade, 1),
            "gunning_fog": round(fog, 1),
            "level": level,
            "avg_sentence_length": round(avg_sentence_len, 1),
            "avg_syllables_per_word": round(avg_syllables_per_word, 2),
            "complex_word_ratio": round(complex_words / num_words, 3),
        }

    def _word_statistics(self, words: list[str]) -> dict:
        from collections import Counter
        stop_words = {
            "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
            "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
            "have", "has", "had", "do", "does", "did", "will", "would", "could",
            "should", "may", "might", "shall", "can", "this", "that", "these",
            "those", "it", "its", "as", "if", "not", "no", "so", "up", "out",
            "about", "into", "than", "more", "also", "their", "they", "we",
            "you", "he", "she", "i", "my", "your", "our", "his", "her",
        }
        filtered = [w for w in words if w not in stop_words and len(w) > 2]
        freq = Counter(filtered)
        top_words = [{"word": w, "count": c} for w, c in freq.most_common(15)]
        unique_ratio = len(set(words)) / max(len(words), 1)

        return {
            "total_words": len(words),
            "unique_words": len(set(words)),
            "unique_ratio": round(unique_ratio, 3),
            "top_words": top_words,
        }
